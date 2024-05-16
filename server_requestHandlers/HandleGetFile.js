/*Handles Getting the File for the Provided Request, DO NOT CALL WITH UNCHECKED INPUT, THIS WILL NOT VALIDATE INPUT FOR YOU*/
import {MIME_TYPES} from "../variables/mimeTypes.js";
import * as path from "path";
import {WriteFileFromStaticPathToResult} from "../FileHandler.js";
import {LogErrorMessage} from "../logger.js";
import {GetFullPathFromRelativePath} from "../InputValidator.js";

export async function HandleGetFile(req, res){
    return new Promise(async (resolve,reject) => {
        const contentPath = GetFullPathFromRelativePath(req.url);
        const contentExtension = path.extname(contentPath).substring(1).toLowerCase();
        const mimeType = MIME_TYPES[contentExtension] || MIME_TYPES.default;
        const statusCode = path.basename(contentPath) === "404.html" ? 404 : 200;

        // Write Result Head
        res.writeHead(statusCode, {"Content-Type" : mimeType});

        const response_message = await WriteFileFromStaticPathToResult(res, contentPath).catch((err) => LogErrorMessage(err.message,err));
        if (!response_message) {return reject("Failed to pipe filestream to result");}
        return resolve("successfuly piped file stream to result");
    });
}
