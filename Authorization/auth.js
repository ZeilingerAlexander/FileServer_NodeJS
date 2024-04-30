
/*Allowed Query endpoints that can be accessed by unauthorized users*/
import {GetQueryRequestRawURL, IsRequestQueryRequest} from "../server_requestHandlers/QueryHandlers.js";
import {GetParsedCookies, GetPasswordHash, GetRequestBody, GetUrlParameters} from "../InputValidator.js";
import {LogDebugMessage, LogErrorMessage} from "../logger.js";
import {
    ExpireAllAuthenticationTokensForUser,
    GenerateAuthenticationToken, GetAccessLevelFromUserID,
    ValidateAuthToken,
    ValidateLogin
} from "../Database/db.js";
import {HandleSimpleResultMessage} from "../server.js";

const AllowedUnauthorizedQueryEndpoints = [
    "PostAuthorizationLogin"
]


/*Handles Authorization on the provided req and result
* resolves with the access level and user id inside an object 
* reject if program should not handle the request any further because auth failed*/
export async function HandleAuthorizationOnRequest(req, res){
    return new Promise(async (resolve,reject) => {
        // Check if authorization is not needed for this request
        if (IsRequestQueryRequest(req) && AllowedUnauthorizedQueryEndpoints.includes(await GetQueryRequestRawURL(req.url))){
            return resolve({accessLevel : 999, userID : -1});
        }
        const cookies = await GetParsedCookies(req.headers.cookie);
        if (!cookies || !cookies.Authorization || !cookies.userID){return reject("failed to get parts of auth cookie");}
        
        if (await ValidateAuthToken(cookies.userID, cookies.Authorization)){
            return resolve({
                accessLevel : await GetAccessLevelFromUserID(cookies.userID),
                userID : cookies.userID
            });
        }
        return reject("Authentication failed");
    });
}


/*Handles the authorization post request, returns reject on invalid credentials*/
export async function HandleAuthorizationLoginOnPost(req,res){
    return new Promise(async (resolve,reject) => {
        const body = await GetRequestBody(req);
        if (!body || !body.password || !body.username){
            await HandleSimpleResultMessage(res, 418, "Bad Request");
            return reject("Failed to get password or username from body");
        }
        
        // validate login
        const name = body.username;
        let userID_errorMessage;
        const userID = await ValidateLogin(name, body.password).catch((err) =>
        {
            userID_errorMessage = err;
            LogErrorMessage(err.message,err);});
        if (!userID){
            await HandleSimpleResultMessage(res, 418, userID_errorMessage);
            return reject("Login Failed");
        }
        
        // login is valid, expire old ones and generate a new one
        await ExpireAllAuthenticationTokensForUser(userID);
        const authToken = await GenerateAuthenticationToken(userID).catch((err) => LogErrorMessage(err.message,err));
        if (!authToken){
            await HandleSimpleResultMessage(res, 418, "Database Error");
            return reject("Failed to generate auth token");
        }
        
        res.writeHead(200, {"Set-Cookie" : [`Authorization=${authToken}; SameSite=Lax;Path=/`, `userID=${userID};SameSite=Lax;Path=/`]});
        res.end();
        resolve("Successfully completed handling auth");
    });
}



/*Logs the user with the given id out of all if any active sessions by invalidatiing the tokens he owns*/
export async function LogoutUser(userid){
    return new Promise(async (resolve,reject) => {
        if (!userid){
            return reject("userid cant be empty");
        }
        const response = await ExpireAllAuthenticationTokensForUser(userid).catch((err) => LogErrorMessage(err.message, err));
        if (!response){
            return reject("Failed to expire all auth tokens for user");
        }
        return resolve("Successfully expired all auth tokens for user");
    });
}
