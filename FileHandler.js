// Handles Interaction With Files, this may not include some stat operations since they are mostly handled by InputValidator.js

import {CheckIFPathExists, GetFullPathFromRelativePath, IsPathFile} from "./InputValidator.js";
import {MIME_TYPES} from "./variables/mimeTypes.js";
import * as path from "path";
import {promises as fsp} from "fs";
import * as fs from "fs";
import {LogErrorMessage} from "./logger.js";
import {reject} from "bcrypt/promises.js";
import {HandleGetFile} from "./server_requestHandlers/HandleGetFile.js";

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
            return resolve("Successfully got 401 page");
        }
        else{
            return reject("Failed to get 401 page");
        }
    });
}

/*Creates a folder with the provided path*/
export async function CreateDirectory(dir_path){
    await fsp.mkdir(dir_path).catch((err) => LogErrorMessage(err.message,err));
}

/*Removes the provided path if it points to a file never rejects*/
export async function RemoveFile(file_path){
    return new Promise (async (resolve) => {
        if (await CheckIFPathExists(file_path).catch((err) => LogErrorMessage(err.message,err)) &&
            await IsPathFile(file_path).catch((err) => LogErrorMessage(err.message,err))){

            await fsp.unlink(file_path).catch((err) => LogErrorMessage(err.message,err));
        }
        return resolve("finished unlinking");
    });
}

/*Removes the provided path if ti points to a file, rejects on any failure*/
export async function RemoveFile_WithErrors(file_path){
    return new Promise (async (resolve,reject) => {
        const DoesPathExist = await CheckIFPathExists(file_path).catch((err) => LogErrorMessage(err.message,err));
        if (DoesPathExist === false){
            return reject("Failed to determine if path exists");
        }
        const isPathFile = await IsPathFile(file_path).catch((err) => LogErrorMessage(err.message,err));
        if (isPathFile === undefined){
            return reject("Failed to determine if path is file");
        }

        if (DoesPathExist && isPathFile){
            const response_msg = await fsp.unlink(file_path).catch((err) => LogErrorMessage(err.message,err));
            if (!response_msg){
                return reject("Failed to unlink file");
            }
        }
        return resolve("finished unlinking");
    });
}