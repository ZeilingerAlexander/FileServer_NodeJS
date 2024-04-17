
/*Allowed Query endpoints that can be accessed by unauthorized users*/
import {GetQueryRequestRawURL, IsRequestQueryRequest} from "../server_requestHandlers/QueryHandlers.js";
import {GetPasswordHash, GetRequestBody, GetUrlParameters} from "../InputValidator.js";
import {LogDebugMessage, LogErrorMessage} from "../logger.js";
import {IsLoginValid} from "../Database/db.js";

const AllowedUnauthorizedQueryEndpoints = [
    "PostAuthorization"
]

/*Handles Authorization on the provided req and result
* resolves if no action is needed
* reject if program should not handle the request any further because auth failed*/
export async function HandleAuthorizationOnRequest(req, res){
    return new Promise(async (resolve,reject) => {
        // Check if authorization is not needed for this request
        if (IsRequestQueryRequest(req) && AllowedUnauthorizedQueryEndpoints.includes(await GetQueryRequestRawURL(req.url))){
            return resolve("Authorization not needed for this request, skipping...");
        }
        // TODO : IMPLEMENT CHECK IF AUTHORIZATION TOKEN IS VALID
        return resolve("NOT IMPLEMENTED");
    });
}


/*Handles the authorization post request, returns reject on invalid credentials*/
export async function HandleAuthorizationLoginOnPost(req,res){
    return new Promise(async (resolve,reject) => {
        const body = await GetRequestBody(req);
        if (!body || !body.password || !body.username){
            return reject("Failed to get password or username from body");
        }
        
        const name = body.username;
        const passwordHash = await GetPasswordHash(body.password).catch((err) => LogErrorMessage(err.message,err));
        if (!passwordHash){
            return reject("Failed to get password hash");
        }
        
        const loginValid = await IsLoginValid(name, passwordHash).catch((err) => LogErrorMessage(err.message,err));
        if (loginValid === undefined){
            return reject("Failed to validate login");
        }
        if (!loginValid){
            return reject("Bad Login Info");
        }
        
        // login is valid
        LogDebugMessage("User Login Valid, generating auth token...");
        
        // TODO : Add generating user authentication token and expiring the old one
        
        
        res.writeHead(200, {"Set-Cookie" : "Authorization=test; SameSite=Lax;Path=/"});
        res.end();
        resolve("test-ignore");
    });
}

/*Logs the user with the given id out of all if any active sessions by invalidatiing the tokens he owns*/
export async function LogoutUser(userid){
    // TODO : Implement
}
