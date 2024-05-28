// Handles Interaction With Files, this may not include some stat operations since they are mostly handled by Validator.js

import {CheckIFPathExists, GetAllFilePathsInDirectory, IsPathFile} from "../Validator.js";
import path from "path";
import fs, {promises as fsp} from "fs";
import {LogDebugMessage, LogErrorMessage} from "../logger.js";
import {HandleGetFile} from "../server_requestHandlers/HandleGetFile.js";
import archiver from "archiver";
import {CreateTempFileMarker, RemoveTempFileMarker} from "./FileLocker.js";

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

/*Safely gets the file read stream by first ensuring that the file is ready to be read
* Returns a fs.createReadStream object for provided static file path. rejects on failure*/
export async function GetFileReadstream_safely(static_path){
    return new Promise (async (resolve,reject) => {
        
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
/*Creates the directory and all directories before it if the provided directory path doesnt exist
* rejects on failed creation*/
export async function CreateDirectoryIfNotExist(dir_path){
    return new Promise(async (resolve,reject) => {
        if (!await CheckIFPathExists(dir_path)){
            const create_response_msg = await fsp.mkdir(dir_path, {recursive : true}).catch((err) => LogErrorMessage(err.message,err));
            if (!create_response_msg){
                return reject("Failed to create directory");
            }
            return resolve("Successfully created directory or directory already existed");
        }
    });
    
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

/*Zips the Provided Directory to the provided output path, resolves when complete, rejects if any values empty or out_path already existing
*  creates a temp file while the file is not finished zipping, removes it on completion*/
export async function ZipDirectoryToPath(dir_to_zip, out_path) {
    return new Promise(async (resolve, reject) => {
        if (!dir_to_zip || !out_path || await CheckIFPathExists(out_path)) {
            return reject("Bad Input");
        }

        const out = fs.createWriteStream(out_path);
        const archive = archiver.create("zip", {
            zlib: {level: 1}
        });

        // on close remove marker + resolve, or reject if marker removing fails
        archive.on("close", async function () {
            // try to remove the marker up to five times since zipping might have been costly, 
            // if after that it still fails to remove just give up and reject
            let marker_remove_retry_attempts = 5;
            let marker_remove_retry_timout_between_attempts = 500;

            // will be defined on remove success
            let marker_remove_response = undefined;

            while (marker_remove_retry_attempts > 0 && !marker_remove_response) {
                marker_remove_response = await RemoveTempFileMarker(out_path).catch((err) => LogErrorMessage(err.message, err));
                if (marker_remove_response) {
                    // success
                    break;
                }
                // no success, wait timeout and retry if enough attempts remaining
                const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
                await delay(marker_remove_retry_timout_between_attempts)
                marker_remove_retry_attempts = marker_remove_retry_attempts - 1;
            }

            // if marker remove response still undefined give up and reject
            if (!marker_remove_response) {
                return reject("Failed to remove marker, giving up");
            }

            return resolve("Successfully saved to zip file");
        });

        // on error remove zip and marker + reject
        archive.on("error", async function (err) {
            LogErrorMessage(err.message, err);

            // remove zip file, if that works remove the old marker for it
            const remove_response_msg = await RemoveFile_WithErrors(out_path).catch((err) => LogErrorMessage(err.message, err));
            if (remove_response_msg) {
                // also remove marker but keep it so further reads will know that it points to a bad zip file,
                // it doesnt matter if it fails or not since its just the marker and we reject anyways
                await RemoveTempFileMarker(out_path).catch((err) => LogErrorMessage(err.message, err));
            }
            return reject("Failed to compress to zip file");
        });

        archive.on("warning", async function (warn) {
            LogDebugMessage(`Received warning from zip-archiver (archiver) : ${warn}`);
        });

        // create marker before piping to output since that will already create the zip file which might or might not fail
        const zipper_create_respone = await CreateTempFileMarker(out_path).catch((err) => LogErrorMessage(err.message, err));
        if (!zipper_create_respone) {
            return reject("Failed to create temp file marker");
        }

        try {
            archive.pipe(out);
        } catch (err) {
            LogErrorMessage(err.message, err);
            return reject("Failed to pipe");
        }


        // get all paths inside directory
        let files = await GetAllFilePathsInDirectory(dir_to_zip);

        // remove possible self-read entries
        files = files.filter((filename) =>
            !((path.basename(filename) === path.basename((out_path)) || path.basename(filename) === path.basename(out_path + process.env.ZIPPER_TEMPFILEMARKEREXTENTION))));

        for (const filesKey in files) {
            const file = files[filesKey];

            // ensure that it exists and is a file
            const stats = await fsp.stat(file).catch((err) => LogErrorMessage(err.message, err));
            if (stats && stats.isFile()) {
                const relativePath = path.relative(dir_to_zip, file);
                try {
                    archive.append(fs.createReadStream(file), {name: relativePath});
                } catch (err) {
                    LogErrorMessage(err.message, err);
                }
            }
        }


        await archive.finalize();
    });
}