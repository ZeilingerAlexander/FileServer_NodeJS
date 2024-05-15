/*Handles getting zipped directory request*/
import * as path from "path";
import {
    CheckIFPathExists, CreateDirectory,
    GetDirectoryStructure,
    GetFileStats,
    GetFullPathFromRelativePath, GetImportantDirectoryInfo_Size_LastModifierz,
    GetSingleURLParameter_ReturnBadRequestIfNotFound,
    GetUrlParameters,
    GetValidatedUserRelativePathFromRequestPath, RemoveFile, ZipDirectoryToPath
} from "../../InputValidator.js";
import {LogErrorMessage} from "../../logger.js";
import {HandleRateLimit} from "../../RateLimiter/RateLimiter.js";
import {HandleSimpleResultMessage} from "../../server.js";
import {WriteFileFromStaticPathToResult} from "../FileHandlers.js";
export async function HandleGetZippedDirectory(req, res){
    return new Promise (async (resolve,reject) => {
        if (!req.accessLevel || req.accessLevel < 2){
            return reject("Access level of at least 2 required");
        }
        
        // instantly apply strong rate limiting since block-size lookup of directories can take a long time and we dont want that being spammed
        if (await HandleRateLimit(req, res, 2)){
            // rate limited
            return resolve("rate limited");
        }
        
        // get directory location from url parameters
        let dirLocation = await GetSingleURLParameter_ReturnBadRequestIfNotFound(req, res, "path").catch(
            (err) => LogErrorMessage(err.message,err));
        if (!dirLocation){
            return reject("Failed to get directory location from url params");
        }
        
        // validate and set the new directory path if necessary (below 4 = no read access to all) this means actual entry point is /users/id
        if (req.accessLevel < 4){
            const validatedRequestPath = await GetValidatedUserRelativePathFromRequestPath(dirLocation, req.userID).catch((err) => LogErrorMessage(err.message,err));
            if (!validatedRequestPath){
                return reject("Failed to validate request path");
            }
            dirLocation = validatedRequestPath;
        }
        
        // Get the full path for the directory and check against path traversal again
        const fullDirectoryPath = GetFullPathFromRelativePath(dirLocation);
        
        // validate path traversal for request directory location
        if (req.accessLevel < 4){
            // validate for user directory
            const userDirectoryStartPath = GetFullPathFromRelativePath(process.env.USERDIRECTORY_RELATIVEPATH.toString() + "/" + req.userID.toString());
            if (!fullDirectoryPath.startsWith(userDirectoryStartPath)){
                return reject("path traversal on lower level detected, this should not happen but it happened regardless, check naming conventions for files etc");
            }
        }
        else{
            // validate for full directory entry point "/" (static, root)
            const rootDirStartPath = process.env.STATIC_PATH;
            if (!fullDirectoryPath.startsWith(rootDirStartPath)){
                return reject("path traversal on lower root level detected, this should not happen but it happened regardless, check naming conventions for files etc");
            }
        }

        
        // get the directory size then determine if more harsh limiting shall be applied
        const directoryInfo = await GetImportantDirectoryInfo_Size_LastModifierz(fullDirectoryPath).catch((err) => LogErrorMessage(err.message,err));
        const directorySize = directoryInfo.size;
        const directoryLastModified = directoryInfo.lastModified;
        if (!directoryInfo || directorySize === undefined || directoryLastModified === undefined){
            return reject("Failed to get directory info");
        }
        
        // apply extreme rate limiting if directory size bigger then max cutoff point
        if (directorySize > process.env.RATELIMIT_BYTESIZE_CUTOFFPOINT_ZIPPEDDIRECTORIES){
            if (await HandleRateLimit(req, res, 3)){
                // rate limited
                return resolve("rate limited");
            }
        }
        
        // check if a zip file with the name already exists under the zip user directory, replace escape characters with _
        // parse the full directory name for later validating against it and also to create a new entry based on it (this is simply the name normalized)
        let full_dir_parsed_name = dirLocation.replaceAll("/", "_");
        full_dir_parsed_name = full_dir_parsed_name.replaceAll("\\", "_");
        full_dir_parsed_name = full_dir_parsed_name.replaceAll("-", "_");
        
        // The full zip directories, first the base path just being the one in env file then the user specific one, these are for validating before getting file stats
        const full_zip_BaseDirectoryPath = await GetFullPathFromRelativePath(process.env.USERZIPDIRECTORY_RELATIVEPATH);
        const full_zip_userDirecotry_path =  path.join( full_zip_BaseDirectoryPath, req.userID);

        // The full expected zip file name, this will be checked if it already exists, if so it will use it instead of creating a new one
        const fullExpectedZipFileNameRelative = full_dir_parsed_name + directoryLastModified + ".zip";
        const fullExpectedZipFileNameStatic = path.join(full_zip_userDirecotry_path, fullExpectedZipFileNameRelative);
        
        // it is on purpose to run them sync in order to achieve in time file system manipulation
        if (!await CheckIFPathExists(full_zip_BaseDirectoryPath)){
            CreateDirectory(full_zip_BaseDirectoryPath);
        }
        if (!await CheckIFPathExists(full_zip_userDirecotry_path)){
            CreateDirectory(full_zip_userDirecotry_path);
        }
        
        // whether or not n existing match was found for the expected zip file path
        let ExistingMatch = false;
        
        // check if it already exists if so use that instead of creating new one, this will also delete all deprecated ones if any come up
        const directoryStructure = await GetDirectoryStructure(full_zip_userDirecotry_path);
        for (const directoryStructureKey in directoryStructure) {
            const entry = directoryStructure[directoryStructureKey];
            if (entry.name.startsWith(full_dir_parsed_name)){
                // file at least starts with expected name now validate date
                if (entry.name === fullExpectedZipFileNameRelative){
                    ExistingMatch = true;
                    break;
                }
                else{
                    // not matching so its an older version, remove it
                    await RemoveFile(fullExpectedZipFileNameStatic);
                }
            }
        }
        
        // if existing match read from exisitng file, if not create new
        if (ExistingMatch){
            const responsemsg = await WriteFileFromStaticPathToResult(res, fullExpectedZipFileNameStatic).catch((err) => LogErrorMessage(err.message,err));
            if (!responsemsg){return reject("Failed to write stream to result");}
            return resolve("Successfully piped existing file to result stream");
        }
        else{
            const response_message = await ZipDirectoryToPath(fullDirectoryPath, fullExpectedZipFileNameStatic).catch((err) => LogErrorMessage(err.message,err));
            if (!response_message){
                // failed
                await HandleSimpleResultMessage(res, 500, "Failed to Zip File");
                return reject("Failed to get zipped file");
            }
            // success so return the zipped file
            const write_response = await WriteFileFromStaticPathToResult(res, fullExpectedZipFileNameStatic).catch((err) => LogErrorMessage(err.message,err));
            if (!write_response){
                // failed
                await HandleSimpleResultMessage(res, 500, "Failed to Zip File");
                return reject("Failed to send file to client");
            }
            return resolve("Zipped File and sent it to client");
        }
    });
}