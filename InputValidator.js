import * as path from "path";
import {promises as fsp} from "fs";
import {AllowedDirectories} from "./variables/AllowedDirectories.js";
import {LogDebugMessage, LogErrorMessage} from "./logger.js";

// ...

/*Gets the full path for the provided relative path by combining the env static path with relative path,
* THIS DOES NOT VALIDATE THE PATH
* Make sure to check against path traversal since when combining pathx with ../../ it goes outsize*/
export function GetFullPathFromRelativePath(relativePath){
    LogDebugMessage(relativePath);
    return path.join(process.env.STATIC_PATH.toString(), relativePath.toString());
}

/*Checks if the provided path is under one of the AllowedDirectories, if not path traversal was attempted and this returns false*/
export async function CheckIfPathIsAllowed(path){
    return new Promise((resolve) => {
        for (const i in AllowedDirectories) {
            if (path.startsWith(AllowedDirectories[i])) {
                return resolve(true);
            }
        }    
        // none validated so path aint valid
        return resolve(false);
    });
}

/*checks if the provided relative path is a directory
* rejects if path is invalid or traversal was attempted
* resolves true if path points to a valid file, false if directory*/
export async function IsRelativePathFile(relativePath){
    return new Promise( async (resolve, reject) => {
        const contentPath = GetFullPathFromRelativePath(relativePath);

        // check against path traversal
        if (!await CheckIfPathIsAllowed(contentPath)){
            return reject("Path Traversal detected");
        }
        // check path existance
        if (!await CheckIFPathExists(contentPath)){
            return reject("Path doesnt exist");
        }
        const isFile = await IsPathFile(contentPath).catch(
            async (err) => await LogErrorMessage(err.message, err)
        )
        if (isFile == null){
            return reject("Failed to get File");
        }
        if (isFile){
            return resolve(true);
        }
        else {
            return resolve(false);
        }
    });
}


/*Checks if the provided path is a file, rejects if not found*/
async function IsPathFile(path){
    return new Promise(async (resolve, reject) => {
        const fileStats = await fsp.lstat(path).catch((err) => LogErrorMessage(err.message,err));
        if (!fileStats){
            return reject("failed to get filestats");
        }
        return resolve(fileStats.isFile());
    });
}

/*Check if the provided path is a directory, rejects if not found*/
export async function IsPathDirectory(path){
    return new Promise(async (resolve,reject) => {
        const fileStats = await fsp.lstat(path).catch((err) => LogErrorMessage(err.message,err));
        if (!fileStats){
            return reject("failed to get filestats");
        }
        return resolve(fileStats.isDirectory());
    });
}

/*Checks if a given path is either a file or directory*/
export async function CheckIFPathExists(path){
    return new Promise(async (resolve) => {
        const stats = await fsp.lstat(path).catch((err) => console.log(err));
        if (!stats){return resolve(false);}
        if (!stats.isFile() && !stats.isDirectory()){
            return resolve(false);
        }
        return  resolve(true);
    });
}

/*Gets the url parameters for the provided url */
export async function GetUrlParameters(url){
    return new Promise( async (resolve, reject) => {
        if (!url){
            return reject("url empty");
    
    }
        // Get url parameter part of the string
        const urlParams = await GetUrlParametersStringFromUrl(url).catch(
            (err) => LogErrorMessage(err.message, err));
        if (!urlParams){
            return reject("Failed to get url parameters");
        }
        
        const urlSearchParams = new URLSearchParams(urlParams);
        if (!urlSearchParams || urlSearchParams.size === 0){
            return reject("url params empty");
        }
        
        return resolve(Object.fromEntries(urlSearchParams.entries()));
    });
}

/*Waits for the request body, resolves with the body*/
export async function GetRequestBody(req){
    return new Promise(async (resolve,reject) => {
        if (!req){
            return reject("body empty");
        }
        let body = "";
        req.setEncoding("utf8");
        req.on("data", data => {
            body += data;
        });
        req.on("end", () => {
            body = JSON.parse(body);
            return resolve(body);
        });
    });
}

/*Gets the url parameters string of the url (everything after the ? )*/
async function GetUrlParametersStringFromUrl(url){
    return new Promise(async (resolve, reject) => {
        url = url.toString();
        if (!url.includes("?")){
            return reject("No Url applicable entry point found (?)");
        }
        return resolve(url.substring(url.indexOf("?"), url.length));
    });
}