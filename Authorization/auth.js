
/*Allowed Query endpoints that can be accessed by unauthorized users*/
import {GetQueryRequestRawURL, IsRequestQueryRequest} from "../server_requestHandlers/QueryHandlers.js";

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
        console.log(req.headers);
        return resolve("NOT IMPLEMENTED");
    });
}


/*Handles the authorization post request, returns reject on invalid credentials*/
export async function HandleAuthorizationLoginOnPost(req,res){
    return new Promise(async (resolve,reject) => {
        res.writeHead(200, {"Set-Cookie" : "Authorization=test; SameSite=Lax;Path=/"});
        res.end();
        resolve("test-ignore");
    });
}

// TODO : Acutall implement a db strucutre for this
// TODO : automaticly expire old cookies for that user if a new login is detected
// TODO : add logout functionality to also expire token