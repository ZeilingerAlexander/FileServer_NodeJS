// Handlers for queries (not files/dirs)

import {HandleGetDirectoryStructure} from "./GETEndpoints/GetDirectoryStructure.js";
import {LogErrorMessage} from "../logger.js";
import {HandleNotFound} from "./FileHandlers.js";
import {HandleAuthorizationLoginOnPost, HandleLogoutUserOnPost} from "../Authorization/auth.js";
import {HandleGetUploadPage} from "./GETEndpoints/GetUploadPage.js";
import {HandleGetPublicResource} from "./GETEndpoints/GetPublicResource.js";

/*The Allowed Query Url entry points, example : /GET/ /POST/, ...*/
const ValidQueryUrlEntryPoints = [
    "/GET/",
    "/POST/"
]

/*The Defined endpoints for query requests -> example : /GET/...*/
const QueryEndpoints = {
    GetDirectoryStructure : HandleGetDirectoryStructure,
    PostAuthorizationLogin : HandleAuthorizationLoginOnPost,
    PostLogoutUser : HandleLogoutUserOnPost,
    GetUploadPage : HandleGetUploadPage,
    GetPublicResource : HandleGetPublicResource
}

/*Handles a Query endpoint defined under QueryEndpoints, returns 404 if not found*/
export async function HandleQuery(req, res){
    return new Promise(async (resolve, reject) => {
        const requestEndpointString = await GetQueryRequestRawURL(req.url);
        const requestEndpoint = QueryEndpoints[requestEndpointString] || undefined;
        if (!requestEndpoint){
            await HandleNotFound(req, res);
            return reject("No Request endpoint found");
        }
        
        const success_message = await requestEndpoint(req, res).catch(
            async (err) => await LogErrorMessage(err.message,err)
        );
        if (!success_message){
            return reject("Request endpoint failed");
        }
        return resolve("Successfully resolved request endpoint");
    });
}

/*Returns the Part of the request after the query entry point and before the paramaters
* example : /GET/getendpoint?params=1234 --RETURNS--> getendpoint
* DO NOT call this on unchecked input since it will stripe url beginning from first / and to second /*/
export async function GetQueryRequestRawURL(url){
    return new Promise( async (resolve, reject) => {
        url = url.toString();
        // Remove everything from the first / to the second / -> example : /POST/query ... query
        url = url.substring(1,url.length);
        const escapePos= url.indexOf("/");
        if (escapePos == -1 || escapePos == url.length-1){
            return reject("Bad URL provided");
        }
        url = url.substring(escapePos+1, url.length);
       
        const ParsedURlWithoutParams = await GetURLWithoutParams(url);
        return resolve(ParsedURlWithoutParams);
    });
}

/*Stripes the params form the provided url then returns it, does not validate anything*/
async function GetURLWithoutParams(url){
    return new Promise((resolve) => {
        if (url.toString().includes("?")){
            const index = url.indexOf("?");
            if (index == 0){
                return resolve("");
            }
            return resolve(url.substring(0, index))
        }
        else{
            return resolve(url);
        }
    });
}



/*Checks if the provided request is a query request, returns true if so, returns false if not*/
export function IsRequestQueryRequest(req){
    for (const reqKey in ValidQueryUrlEntryPoints) {
        if (req.url.toString().startsWith(ValidQueryUrlEntryPoints[reqKey])){
            return true;
        }
    }
    return false;
}