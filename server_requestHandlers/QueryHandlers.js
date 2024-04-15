// Handlers for queries (not files/dirs)

/*The Defined Get endpoints for the part after the /GET/*/
import {HandleGetDirectoryStructure} from "./GETEndpoints/GetDirectoryStructure.js";
import {LogErrorMessage} from "../logger.js";
import {HandleAuthorizationOnPost} from "../Authorization/auth.js";

const QueryEndpoints = {
    GetDirectoryStructure : HandleGetDirectoryStructure,
    PostAuthorization : HandleAuthorizationOnPost
}

/*Handles a /GET/ or /POST/ query, returns 404 if not found*/
export async function HandleQuery(req, res){
    return new Promise(async (resolve, reject) => {
        const requestEndpointString = await GetRequestRawURL(req.url);
        const requestEndpoint = QueryEndpoints[requestEndpointString] || undefined;
        if (!requestEndpoint){
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

/*Returns the Part of the get request after /GET/ or /POST/ and before the paramaters
* example : /GET/getendpoint?params=1234 --RETURNS--> getendpoint*/
export async function GetRequestRawURL(url){
    return new Promise( async (resolve, reject) => {
        url = url.toString();
        let rawURL = "";
        if (url.startsWith("/GET/")){
            rawURL =  url.substring(5, url.length);
        }
        else if (url.startsWith("/POST/")){
            rawURL =  url.substring(6, url.length);
        }
        else{
            return reject("Bad URL provided");
        }
       
        const rawGetUrlWithoutParams = await GetURLWithoutParams(rawURL);
        return resolve(rawGetUrlWithoutParams);
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
