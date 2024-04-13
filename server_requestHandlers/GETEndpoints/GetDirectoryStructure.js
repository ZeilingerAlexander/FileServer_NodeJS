// /GET/GetDirectoryStructure
import {GetUrlParameters} from "../../InputValidator.js";
import {LogErrorMessage} from "../../logger.js";
import fs from "node:fs";
import { promises as fsp } from "node:fs";

export async function HandleGetDirectoryStructure(req, res){
    return new Promise( async (resolve, reject) => {
        const urlParams = await GetUrlParameters(req.url).catch(
            (err) => LogErrorMessage(err.message, err)
        );
        if (!urlParams){
            return reject("Failed to get url parameters");
        }
        
        // get the val entry of url paramaters since thats where directory location resides
        const dirLocation = urlParams["val"];
        if (!dirLocation) {
            return reject("Url Paramter val not found, cant get directory location");
        }
        
        
    });
}