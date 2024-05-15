/*Handles getting zipped directory request*/
import * as path from "path";
import {
    CheckIFPathExists, CreateDirectory,
    GetDirectoryStructure,
    GetFileStats,
    GetFullPathFromRelativePath, GetImportantDirectoryInfo_Size_LastModifierz,
    GetSingleURLParameter_ReturnBadRequestIfNotFound,
    GetUrlParameters,
    GetValidatedUserRelativePathFromRequestPath, RemoveFile, ZipDirectoryToPath, Zipper_CheckIfFileISReady
} from "../../InputValidator.js";
import {LogErrorMessage} from "../../logger.js";
import {HandleRateLimit} from "../../RateLimiter/RateLimiter.js";
import {HandleSimpleResultMessage} from "../../server.js";
import {WriteFileFromStaticPathToResult} from "../FileHandlers.js";
export async function HandlePostCreateZippedDirectory(req, res){
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

        /* TODO : Only directly download files below roughly 100mb since the file will need to be loaded into memory in order to be downloaded
           we can expect everyone to have roughly 1mb/s download speed and a computer with at least 100mb spare ram for browser tabs so its fine to download that
           for those files show 
           
           now for larger files instead return a certain error code that frontend will understand
           with this error code it will redirect to user zip export page
           on this page user is shown all the zip exports, their status (if they are downloadable) and links to them
                the get endpoint for them should open the link in a new tab for browser to handle download and should just be forwarded to handlegetfile or smth
           this of course needs proper implementation with an in-memory storage and a custom get endpoint for file availability
           create a temp file called the same as the zip export in same dir but with some extension or something this is to ensure that files that are currently being worked on are sure to be done
                on any error first remove the zip file then the temp file marker (if removing failed zip file works, if not just keep it)
                on each server startup clean up by trying to load all available zip-exports marked as "ready" meaning ready to download
                    BUT if a marker file exists for that file it means that the zip file is bad and should be removed, then first remove the zip file and if that works the marker
            
        */

        // if existing match use that file instead of creating new one
        if (ExistingMatch){
            // check the filestats for size then decide if to download directly or to shift to the zipped directories
            const filestats = await GetFileStats(fullExpectedZipFileNameStatic).catch((err) => LogErrorMessage(err.message, err));
            if (!filestats || !filestats.size){
                return reject("Failed to get filestats for should-be existing file");
            }
            
            // check if file is ready
            if (!await Zipper_CheckIfFileISReady(fullExpectedZipFileNameStatic)){
                // file isnt ready, do not reject since that will produce a response on its own
                await HandleFileNotReadyResponse(res);
                return resolve("File not ready yet, not sending file");
            }

            // download file or redirect
            if (filestats.size < Math.pow(10, 8)){
                // smaller then 100mb, download directly

                const responsemsg = await WriteFileFromStaticPathToResult(res, fullExpectedZipFileNameStatic).catch((err) => LogErrorMessage(err.message,err));
                if (!responsemsg){return reject("Failed to write stream to result");}
                return resolve("Successfully piped existing file to result stream");
            }
            else{
                // larger then 100mb, redirect
                await HandleFileTooLargeRedirectResponse(res);
            }
        }
        else{
            // TODO : update this, only redirect or download if small enough when the file finishes uploading. during the upload user shouldnt close the page
            throw "implement";
            
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

/*Handles the file not ready to be downloaded yet response, never rejects even tho it can fail to process the expected result*/
async function HandleFileNotReadyResponse(res){
    return new Promise (async (resolve) => {
        await HandleSimpleResultMessage(res, 423, "file not ready").catch((err) => LogErrorMessage(err.message,err));
        return resolve("completed handling simple result message saying file not ready, maybe failed but completed!");
    });
}

/*Handles the response to redirect user to the user/zip page if the file is too large, never rejects but can fail*/
async function HandleFileTooLargeRedirectResponse(res){
    return new Promise (async (resolve) => {
        await HandleSimpleResultMessage(res, 303, "file too large, redirecting").catch((err) => LogErrorMessage(err.message,err));
        // TODO : FIx redirect to include actual redirect in body for frontend to auto-redirect
        return resolve("completed handling simple result 303 saying file to olarge redirecting");
    });
}