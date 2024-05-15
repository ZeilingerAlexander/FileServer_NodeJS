import * as path from "path";
import {promises as fsp} from "fs";
import * as fs from "fs";
import {AllowedDirectories} from "./variables/AllowedDirectories.js";
import {LogDebugMessage, LogErrorMessage} from "./logger.js";
import * as bcrypt from "bcrypt";
import {HandleSimpleResultMessage} from "./server.js";
import {MIME_TYPES} from "./variables/mimeTypes.js";
import archiver from "archiver";

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


/*Gets the relative user path from the base request by combining the base request path with the user path and the userid
* then validates it by checking if the new combined path starts with /[env.user]/[userId], rejects if the new path lies outside the bounds of the user path
* Also Automaticly creates the user directory if it doesnt exist and the directory for that id*/
export async function GetValidatedUserRelativePathFromRequestPath(url, userID){
    return new Promise (async (resolve,reject) => {
        const fullPath = path.join(process.env.USERDIRECTORY_RELATIVEPATH.toString(),userID.toString(),url.toString());
        const expectedPathStart = path.join(process.env.USERDIRECTORY_RELATIVEPATH.toString(),userID.toString());
        
        if (fullPath.startsWith(expectedPathStart)){
            const userDirectoryPath = path.join(process.env.STATIC_PATH, process.env.USERDIRECTORY_RELATIVEPATH.toString());
            const userIdDirectoryPath = path.join(process.env.STATIC_PATH, expectedPathStart);
            
            if (!await CheckIFPathExists(userDirectoryPath)){
                await fsp.mkdir(userDirectoryPath);
            }
            if (! await CheckIFPathExists(userIdDirectoryPath)){
                await fsp.mkdir(userIdDirectoryPath);
            }
            
            return resolve(fullPath);
        }
        return reject("Failed to validate the full combined path for user directory");
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
            if (body){
                body = JSON.parse(body);
            }
            return resolve(body);
        });
    });
}

/*Returns the Hash for the provided password*/
export async function GetPasswordHash(password){
    return new Promise(async (resolve, reject) => {
        if (!password){return reject("password empty");}
        return resolve(await bcrypt.hash(password,10));
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

/*Returns a usable acces token*/
export async function GenerateNewAccesToken(){
    return new Promise (async (resolve,reject) => {
        let a = new Uint8Array(250);
        crypto.getRandomValues(a);
        let key = btoa(String.fromCharCode.apply(null, a));
        
        // add random value to ensure it not being empty resulting in infiinite loop below
        key += "_$sd";
        
        while (key.length < 250){
            key += key;
        }
        return resolve(key.substring(0,250));
    });
}

/*Gets the Parsed Cookies object (key,value) from the provided cookie string
* offers default protection by limiting the input, this can be overwritten by setting overwritePortetcion to true (parm2)*/
export async function GetParsedCookies(cookiestr, overwriteProtection){
    return new Promise(async (resolve, reject) => {
        // return empty if cookiestr empty
        if (!cookiestr){
            return resolve(undefined);
        }
        
        // limit input if overwritePortection true
        if (!overwriteProtection){
            const equalCount = (cookiestr.match(/=/g) || []).length;
            if (equalCount > 100){
                return reject("input too large");
            }
        }
        
        //c o o k i e = t e s t ; c l o c k = t i c k
        //c o o k i e[=]t e s t ; c l o c k = t i c k
        //c o o k i e[=]t e s t [;] c l o c k = t i c k
        //[c o o k i e][=][t e s t] [;] c l o c k = t i c k
        //      key         val         i
        
        let cookies = {};
        let index = 0;
        while (index < cookiestr.length){
            let equalIndex = cookiestr.indexOf("=", index);
            let semiIndex = cookiestr.indexOf(";", index);
            
            // no more entries
            if (equalIndex === -1){
                break;
            }
            
            // default semiIndex to lastpos if no found
            if (semiIndex === -1){
                semiIndex = cookiestr.length;
            }
            
            let key = cookiestr.slice(index,equalIndex).trim();
            let value = cookiestr.slice(equalIndex+1,semiIndex).trim();
            cookies[key] = value;
            index = semiIndex+1;
        }
        return resolve(cookies);
    });
}

/*Checks if the provided data and hash match, this is not an equals operation due to salting, rejects on empty input*/
export async function DoesDataMatchHash(data, hash){
    return new Promise (async (resolve,reject) => {
        if (!data || !hash){
            return reject("data and hash cant be empty")}
        return resolve(await bcrypt.compare(data, hash));
    });
}


/*Gets a single url parameter by name, returns a bda request error if not found and rejects*/
export async function GetSingleURLParameter_ReturnBadRequestIfNotFound(req,res,parameter_name){
    return new Promise (async (resolve,reject) => {
        const urlParams = await GetUrlParameters(req.url).catch(
            (err) => LogErrorMessage(err.message, err)
        );
        if (!urlParams){
            await HandleSimpleResultMessage(res, 405, "Bad URL Parameters");
            return reject("Failed to get url parameters");
        }

        // get the entry of the url parameters
        let url_param = urlParams[parameter_name];
        if (!url_param) {
            await HandleSimpleResultMessage(res, 405, "Bad URL Parameters");
            return reject("Url Paramter val not found");
        }
        
        return resolve(url_param);
    });
}


/*Gets the directory size of the provided directory path, never rejects*/
export async function GetImportantDirectoryInfo_Size_LastModifierz(directory_path){
    return new Promise (async (resolve) => {
        let totalSize = 0;
        let latestModified = 0;
        const dir = await fsp.readdir(directory_path).catch((err) => LogErrorMessage(err.message,err));
        // ignore errors to no overcomplicate things
        if (!dir){return resolve({size : 0, lastModified : 0});}
        
        // TODO : Refactor this hellish landscape
        
        // iterate through dir and add file / directory size to total size
        for (let i in dir){
            const entry = dir[i];
            const entryPath = path.join(directory_path, entry);
            const fileStats = await fsp.lstat(entryPath).catch((err) => LogErrorMessage(err.message,err));
            // ignore errors on purpose to not overcomplicate things
            if (fileStats){
                if (fileStats.isDirectory()){
                    // recursively re-call if directory
                    const directory_info = await GetImportantDirectoryInfo_Size_LastModifierz(entryPath).catch((err) => LogErrorMessage(err.message,err));
                    const directory_size = directory_info.size;
                    
                    // check if last modified greater
                    if (directory_info.lastModified > latestModified){
                        latestModified = directory_info.lastModified;
                    }
                    
                    if (directory_size){
                        totalSize = totalSize + directory_size
                    }
                }
                else{
                    // not directory so its file get size from this
                    totalSize = totalSize + fileStats.size ? fileStats.size : 0;

                    // check if last modified greater
                    if (fileStats.mtimeMs > latestModified){
                        latestModified = fileStats.mtimeMs;
                    }
                }
            }
        }
        return resolve({size : totalSize, lastModified : latestModified});
    });
}

/*Gets filestats for the provided path*/
export async function GetFileStats(content_path){
    return new Promise (async (resolve,reject) => {
        const fileStats = await fsp.lstat(content_path).catch((err) => LogErrorMessage(err.message,err));
        if (!fileStats){
            return reject("failed to get filestats");
        }
        return resolve(fileStats);
    });
}

/*Gets the Directory Structure, rejects on failure
* Resolves with a structure of files {name (the name of the file), Directory (if the file is a directory or not), 
* size (size in bytes), lastModified, creationTime}*/
export async function GetDirectoryStructure(dir_path){
    return new Promise (async (resolve,reject) => {
        const dir = await fsp.readdir(dir_path).catch(
            (err) => LogErrorMessage(err.message, err)
        );
        if (!dir){
            return reject("Failed to read directory");
        }
        
        // normalize directory path to allow for adding entries to the end
        const normalizedDirectoryPath = (dir_path.endsWith("/") || dir_path.endsWith("\\"))
            ? dir_path : (dir_path + "/");

        // build the directory with proper types (directory/file)
        let DirectoryStructure = [];
        for (const i in dir) {
            const directoryEntry = dir[i];
            const FullEntryPath = normalizedDirectoryPath + directoryEntry;
            const fileStats = await fsp.lstat(FullEntryPath).catch(
                (err) => LogErrorMessage(err.message,err)
            );

            if (!fileStats){
                continue;
            }
            
            // check if is directory
            const isDirectory = fileStats && fileStats.isDirectory() && !fileStats.isFile();

            // push to directory structure
            DirectoryStructure.push(
                {
                    name : directoryEntry,
                    Directory : isDirectory,
                    size : fileStats.size,
                    lastModified : fileStats.mtimeMs,
                    creationTime : fileStats.birthtimeMs
                }
            );
        }
        
        return resolve(DirectoryStructure);
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

/*Zips the Provided Directory to the provided output path, resolves when complete, rejects if any values empty or out_path already existing*/
export async function ZipDirectoryToPath(dir_to_zip, out_path){
    return new Promise (async (resolve,reject) => {
        if (!dir_to_zip || !out_path || await CheckIFPathExists(out_path)){
            return reject("Bad Input");
        }

        const out = fs.createWriteStream(out_path);
        const archive = archiver.create("zip", {
            zlib : {level: 9}
        });
        out.on("close", function (){
            return resolve("Successfully saved to zip file");
        });
        
        out.on("error", function (err){
            LogErrorMessage(err.message,err);
            return reject("Failed to compress to zip file");
        });
        
        archive.pipe(out);

        // get all paths inside directory
        const files = await GetAllFilePathsInDirectory(dir_to_zip);
        console.log("nay")
        console.log("nay")
        console.log("nay")
        for (const filesKey in files) {
            const file = files[filesKey];
            
            const stats = await fsp.stat(file).catch((err) => LogErrorMessage(err.message,err));
            console.log(file);
            if (stats && stats.isFile()){
                console.log("hey")
                const relativePath = path.relative(dir_to_zip, file);
                archive.append(fs.createReadStream(file), {name : relativePath});
            }
        }
        
        archive.finalize();
    });
}


/*Gets all the file paths inside a directory including sub-directories, rejects on read error or bad data*/
async function GetAllFilePathsInDirectory(dirPath, arr){
    return new Promise (async (resolve,reject) => {
        if (!dirPath){
            return reject("bad input");
        }
        
        // create array if not existing
        if (!arr){
            arr = [];
        }
        
        const dirStructure = await GetDirectoryStructure(dirPath).catch((err) => LogErrorMessage(err));
        if (!dirStructure){
            // reject if failed
            return reject("failed to get dir structure");
        }
        
        // write in order :
        // file
        // file
        // folder
        //      file
        //      file
        //      folder
        //          file
        // file
        
        for (const dirStructureKey in dirStructure) {
            const entry = dirStructure[dirStructureKey];
            // append to array, first normalize directoery path to always end with /
            const normalizedEntryPath = ((dirPath.endsWith("/") || dirPath.endsWith("\\")) ? dirPath : dirPath + "/");
            arr.push(normalizedEntryPath + entry.name);
            
            // if its a directory call again after writing the directory entry to the array already
            if (entry.isDirectory){
                arr = await GetAllFilePathsInDirectory(normalizedEntryPath, arr);
            }
        }
        
        // resolve with array
        return resolve(arr);
    });
}