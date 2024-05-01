
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
import {HandleRateLimit} from "../RateLimiter/RateLimiter.js";

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
        // apply strong late limiting due to db access and crypto function calling
        if (await HandleRateLimit(req, res, 2)){
            return resolve("Rate Limited");
        }
        
        
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

/*Handles the post request for user logout, only works if user login info is correct in auth cookie to prevent abuse*/
export async function HandleLogoutUserOnPost(req,res){
    return new Promise (async (resolve,reject) => {
        // apply strong late limiting due to db access and crypto function calling
        if (await HandleRateLimit(req, res, 2)){
            return resolve("Rate Limited");
        }
        
        // get user id from auth cookie
        const cookies = await GetParsedCookies(req.headers.cookie);
        if (!cookies || !cookies.userID || !cookies.Authorization){
            await HandleSimpleResultMessage(res, 400, "bad request");
            return reject("failed to get parts of auth cookie");
        }

        // attempt to logout user by first validating auth then logging him out
        if (await ValidateAuthToken(cookies.userID, cookies.Authorization)){
            const response_message = await LogoutUser(cookies.userID).catch((err) => LogErrorMessage(err.message,err));
            if (!response_message){
                await HandleSimpleResultMessage(res, 500, "Internal server error");
                return reject("Failed to logout user");
            }
        }
        
        // nothing failed so logout shouldve worked
        await HandleSimpleResultMessage(res, 200, "User Logout Success");
        return resolve("successfully logged out user");
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
