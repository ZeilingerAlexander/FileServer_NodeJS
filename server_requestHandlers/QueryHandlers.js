// Handlers for queries (not files/dirs)

/*The Defined Get endpoints for the part after the /GET/*/
import {HandleGetDirectoryStructure} from "./GETEndpoints/GetDirectoryStructure.js";

const GetEndpoints = {
    GetDirectoryStructure : HandleGetDirectoryStructure
}

/*Handles a /GET/ query, returns 404 if not found*/
export async function HandleGetQuery(req, res){
    return new Promise(async (resolve, reject) => {
        const requestEndpointString = await GetRequestRawURL(req.url);
        const requestEndpoint = GetEndpoints[requestEndpointString] || undefined;
        if (!requestEndpoint){
            return reject("No Request endpoint found");
        }
        
        const success_message = await requestEndpoint(req, res).catch(
            (err) => console.log(err)
        );
        if (!success_message){
            return reject("Request endpoint failed");
        }
        return resolve("Successfully resolved request endpoint");
    });
}

/*Returns the Part of the get request after /GET/ and before the paramaters
* example : /GET/getendpoint?params=1234 --RETURNS--> getendpoint*/
export async function GetRequestRawURL(url){
    return new Promise( async (resolve, reject) => {
        url = url.toString();
        if (!url.startsWith("/GET/")){
            return reject("Bad URL provided");
        }
        const rawGetUrl = url.substring(5, url.length);
        const rawGetUrlWithoutParams = await GetURLWithoutParams(rawGetUrl);
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
