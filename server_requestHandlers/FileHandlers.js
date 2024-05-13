// Handles Interaction With Files

import {GetFullPathFromRelativePath} from "../InputValidator.js";
import {MIME_TYPES} from "../variables/mimeTypes.js";
import * as path from "path";
import * as fs from "fs";
import {LogErrorMessage} from "../logger.js";
import {reject} from "bcrypt/promises.js";

/*Handles Getting the File for the Provided Request, DO NOT CALL WITH UNCHECKED INPUT, THIS WILL NOT VALIDATE INPUT FOR YOU*/
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

/*Does exactly what the name says pipes static path file stream to result, rejects on failure
* THIS DOES NOT WRITE THE RESULT HEAD, ALL THIS DOES IS PIPE THE FILE STREAM DO NOT EXPECT ANYTHING ELSE*/
export async function WriteFileFromStaticPathToResult(res, static_path){
    return new Promise(async (resolve,reject) => {
        // pipe file stream to result, then return
        try{
            fs.createReadStream(static_path).pipe(res);
            return resolve("Piping File Stream was successful");
        } catch (ex) {
            await LogErrorMessage(ex.message, ex);
            return reject("Piping File Stream failed ", ex.message);
        } 
    });
}

/*Handles returning the 404 Page*/
export async function HandleNotFound(req,res){
    return new Promise(async (resolve, reject) => {
        // expect the 404 page to exist, if anything fails reject
        // Handle it over the default get file handler by changing the url
        req.url = process.env.ERRORPAGE_RELATIVEPATH;
        const success_message = await HandleGetFile(req, res).catch(
            (err) => console.log(err)
        )
        if (success_message){
            return resolve("Successfully got 404 page");
        }
        else{
            return reject("Failed to get 404 page");
        }
    });
}

/*Handles returning the 403 page*/
export async function HandleUnauthorized(req,res){
    return new Promise (async (resolve,reject) => {
        req.url = process.env.UNAUTHORIZEDPAGE_RELATIVEPATH;
        const success_message = await HandleGetFile(req, res).catch(
            (err) => console.log(err)
        )
        if (success_message){
            return resolve("Successfully got 403 page");
        }
        else{
            return reject("Failed to get 403 page");
        }
    });
}