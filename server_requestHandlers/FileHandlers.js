// Handles Interaction With Files

import {GetFullPathFromRelativePath} from "../InputValidator.js";
import {MIME_TYPES} from "../variables/mimeTypes.js";
import * as path from "path";
import * as fs from "fs";

/*Handles Getting the File for the Provided Request, DO NOT CALL WITH UNCHECKED INPUT, THIS WILL NOT VALIDATE INPUT FOR YOU*/
export async function HandleGetFile(req, res){
    return new Promise(async (resolve,reject) => {
        const contentPath = GetFullPathFromRelativePath(req.path);
        const contentExtension = path.extname(contentPath).substring(1).toLowerCase();
        const mimeType = MIME_TYPES[contentExtension] || MIME_TYPES.default;
        const statusCode = path.basename(contentPath) === "404.html" ?? 404 || 200;
        
        // Write Result Head
        res.writeHead(statusCode, {"Content-Type" : mimeType});
        
        // pipe file stream to result, then return
        try{
            fs.createReadStream(contentPath).pipe(res);
            return resolve("Piping File Stream was successful");
        } catch (ex) {
            console.log(ex);
            return reject("Piping File Stream failed ", ex.message);
        }
    });
}