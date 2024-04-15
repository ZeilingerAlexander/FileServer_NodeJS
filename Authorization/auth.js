
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