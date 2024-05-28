/*Handles getting zipped directory request*/
import * as path from "path";
import {
    CheckIFPathExists, GetDirectorySize,
    GetDirectoryStructure,
    GetFileStats,
    GetFullPathFromRelativePath, GetImportantDirectoryInfo_Size_LastModifierz,
    GetSingleURLParameter_ReturnBadRequestIfNotFound,
    GetValidatedUserRelativePathFromRequestPath
} from "../../Validator.js";
import {
    CheckIfFileHasFileMarker, GetFileReadiness_RemoveOldMarkers
} from "../../FileInteractions/FileLocker.js"
import {LogErrorMessage} from "../../logger.js";
import {HandleRateLimit} from "../../RateLimiter/RateLimiter.js";
import {HandleSimpleResultMessage, HandleTemporaryRedirectionResult} from "../../server.js";
import {
    CreateDirectory, CreateDirectoryIfNotExist,
    RemoveFile,
    RemoveFile_WithErrors,
    WriteFileFromStaticPathToResult, ZipDirectoryToPath
} from "../../FileInteractions/FileHandler.js";
export async function HandlePostCreateZippedDirectory(req, res){
    return new Promise (async (resolve,reject) => {
        //#region verify request and get parse data from request
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
        if (directorySize > process.env.RATELIMIT_BYTESIZE_CUTOFFPOINT_ZIPPEDDIRECTORIES && await HandleRateLimit(req, res, 3)){
            // rate limited
            return resolve("rate limited");
        }

        // check if a zip file with the name already exists under the zip user directory, replace escape characters with _
        // parse the full directory name for later validating against it and also to create a new entry based on it (this is simply the name normalized)
        // also create a zipped version of it
        let full_dir_parsed_name = dirLocation.replaceAll("/", "_");
        full_dir_parsed_name = full_dir_parsed_name.replaceAll("\\", "_");
        full_dir_parsed_name = full_dir_parsed_name.replaceAll("-", "_");
        let full_dir_parsed_name_zip = dirLocation.replaceAll("/","").replaceAll("\\","") + ".zip";

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
        //#endregion
        
        // whether or not an existing match was found for the expected zip file path
        let ExistingMatch = false;

        // check if it already exists if so use that instead of creating new one, this will also delete all deprecated ones if any come up
        const FileReadyLevel = await GetFileReadiness_RemoveOldMarkers(fullExpectedZipFileNameStatic);
        if (FileReadyLevel === 1){
            // file ready level is 1  so it means its  ready, meaning that we just use that
            ExistingMatch = true;
        }else if (FileReadyLevel === 2){
            // file ready level is 2 so we just redirect
            await HandleRedirectToZipPage(res);
            return resolve("completed handling redirect to zip page");
        }
        else{
            // file is not ready so just set existing match to false
            ExistingMatch = false;
        }
        
        // TODO : fully rewrite this garbage since it doesnt work. just go through the workings again and only write file if file readyness = 3
        // also for some reason we never zip it. so fix that aswell
        
        // if existing match use that file instead of creating new one
        if (ExistingMatch){
            // check the filestats for size then decide if to download directly or to shift to the zipped directories
            const filestats = await GetFileStats(fullExpectedZipFileNameStatic).catch((err) => LogErrorMessage(err.message, err));
            if (!filestats || !filestats.size){
                return reject("Failed to get filestats for should-be existing file");
            }
            
            // check if file is not ready, check it via file marker since we return beforehand if in-memory marker is set
            // but we keep going if it only has file marker to allow for re-trying
            if (await CheckIfFileHasFileMarker(fullExpectedZipFileNameStatic)){
                // file isnt ready, do not reject since that will produce a response on its own
                await HandleFileNotReadyResponse(res);
                return resolve("File not ready yet, not sending file");
            }

            // download file or redirect
            if (filestats.size < process.env.ZIPPER_MAXALLOWEDDIRECTODOWNLOADSIZE){
                // smaller then 100mb, download directly

                const responsemsg = await HandleDirectDownload(res, fullExpectedZipFileNameStatic, full_dir_parsed_name_zip).catch((err) => LogErrorMessage(err.message,err));
                if (!responsemsg){return reject("Failed to write stream to result");}
                return resolve("Successfully piped existing file to result stream");
            }
            else{
                // larger then 100mb, redirect
                await HandleFileTooLargeRedirectResponse(res);
                return resolve("completed redirecting to user zip export page, this might have failed but exiting regardless");
            }
        }
        else{
            // folder should be zipped
            // determine if the folder exceeds the max allowed payload (this is not perfect since zipped files are obviosly tinier to *2 it)
            const folder_size = await GetDirectorySize(fullDirectoryPath);
            const fileTooLarge_performRedirect = (folder_size / 2 >= process.env.ZIPPER_MAXALLOWEDDIRECTODOWNLOADSIZE)
            
            if (fileTooLarge_performRedirect){
                // handle redirect to "resolve" the request endpoint in frontend and mark the file as being-written
                // since no more data from frontend is needed its fine to return a http response here, but dont resolve since we still need to actually write the zip file
                await HandleFileTooLargeRedirectResponse(res);
                return resolve("competed redirecting user to zip export page, this might have failed");
            }

            const response_message = await ZipDirectoryToPath(fullDirectoryPath, fullExpectedZipFileNameStatic).catch((err) => LogErrorMessage(err.message,err));
            if (!response_message){
                // failed, still resolve due to handling the bad response on handlesimpleresultmessage
                await HandleSimpleResultMessage(res, 500, "Failed to Zip File");
                return resolve("Failed to get zipped file");
            }
            
            const filestats = await GetFileStats(fullExpectedZipFileNameStatic).catch((err) => LogErrorMessage(err.message, err));
            if (!filestats || !filestats.size){
                // failed, still resolve due to handling the bad response on handlesimpleresultmessage
                await HandleSimpleResultMessage(res,  500, "Failed to get Stats from written zip file");
                return resolve("Failed to get filestats for should-be existing file");
            }
            
            // file zipping completed, if fileTooLarge_performRedirect = true we already wrote an addaquate response by redirecting if not directly download
            if (fileTooLarge_performRedirect){
                return resolve("Successfully zipped file");
            }
            
            // download directly since below 100mb
            const write_response = await HandleDirectDownload(res, fullExpectedZipFileNameStatic, full_dir_parsed_name_zip).catch((err) => LogErrorMessage(err.message,err));
            if (!write_response){
                // failed, still resolve due to handling the bad response on handlesimpleresultmessage
                await HandleSimpleResultMessage(res, 500, "Failed to write zip File to result");
                return resolve("Failed to send file to client");
            }
            
            return resolve("Successfully wrote zipped file to response");
        }
    });
}

/*Handles the file not ready to be downloaded yet response, never rejects even tho it can fail to process the expected result
* if it fails it only failed to write simple result message so it would fail regardless, this means that program should just exit*/
async function HandleFileNotReadyResponse(res){
    return new Promise (async (resolve) => {
        await HandleSimpleResultMessage(res, 423, "file not ready").catch((err) => LogErrorMessage(err.message,err));
        return resolve("completed handling simple result message saying file not ready, maybe failed but completed!");
    });
}

/*Handles the response to redirect user to the user/zip page if the file is too large, never rejects but can fail, 
if it fails it only failed to write simple result message so it would fail regardless, this means that program should just exit*/
async function HandleFileTooLargeRedirectResponse(res){
    return new Promise (async (resolve) => {
        await HandleRedirectToZipPage(res);
        return resolve("completed handling temp redirect to zip page");
    });
}

/*Handles redirecting to zip page, never rejects*/
async function HandleRedirectToZipPage(res){
    return new Promise (async (resolve) => {
        await HandleTemporaryRedirectionResult(res,"/GET/GetPublicResource?val=/Zipper/ZipExportsViewer.html").catch((err) => LogErrorMessage(err.message,err));
        return resolve("completed");
    });
}

/*Handles directly downloading the file, rejects if failure to write to res or other reason
* Also writes the correct headers for file name*/
async function HandleDirectDownload(res, fullpath, filename){
    return new Promise (async (resolve,reject) => {
        res.writeHead(200, {"Content-Disposition" : `attachment; filename=${filename}`});
        const response =  await WriteFileFromStaticPathToResult(res, fullpath).catch((err) => LogErrorMessage(err.message,err));
        if (!response){
            return reject("Failed to handle directly donwloading zipped file");
        }
        else{
            return  resolve("Successfully downloaded zipped file directly");
        }
    });
}