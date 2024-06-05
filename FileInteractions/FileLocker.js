import {CheckIFPathExists} from "../Validator.js";
import * as fs from "fs";
import {LogDebugMessage, LogErrorMessage} from "../logger.js";
import {RemoveFile_WithErrors} from "./FileHandler.js";

// ...

// will contain files currently locked
let LockedFiles = new Set();

/*Creates a temp file marker for the file residing on provided path, this marker indicates that the file is currently being written
also adds the marker to temp paths, only adds it if its not already added (this may cause conflicts so check beforehand if it exists)
* rejects on error*/
export async function CreateTempFileMarker(content_path){
    return new Promise(async (resolve,reject) => {
        const full_path = content_path+process.env.TEMPFILEMARKEREXTENTION;
        fs.writeFile(full_path, "", err => {
            if (err){
                LogErrorMessage(err.message, err);
                return reject("Failed to create temp file");
            }
            if (!LockedFiles.has(content_path)){
                LockedFiles.add(content_path);
            }
            else{
                LogDebugMessage("File already had a temp file marker, this shouldve been checked before calling this function since it may indicate that the file is broken, resolving anyways.");
            }
            return resolve("Wrote file successfully");
        });
    });
}

/*Removes the temp file marker for the file residing in the provided path, removing the marker indicates that the file was written without errors*/
export async function RemoveTempFileMarker(content_path){
    return new Promise (async (resolve,reject) => {
        const fullFilePath = content_path + process.env.TEMPFILEMARKEREXTENTION;

        // remove from in-memory storage
        if (LockedFiles.has(content_path)){
            LockedFiles.delete(content_path);
        }
        
        // check if it even exists
        const doesPathExist = await CheckIFPathExists(fullFilePath);
        if (!doesPathExist){
            return resolve("Successfully removed temp file marker");
        }

        const response_msg = await RemoveFile_WithErrors(fullFilePath).catch((err) => LogErrorMessage(err.message,err));
        if (!response_msg){
            return reject("Failed to remove temp file marker");
        }
        return resolve("Succesfully remove temp file marker");
    });
}

/*Checks if the file at file_path location has an associated file-not-ready marker, never rejects only resolves (true/false) -> true if marker*/
export async function CheckIfFileHasFileMarker(file_path){
    return new Promise (async (resolve) => {
        const fullfilepath = file_path+process.env.TEMPFILEMARKEREXTENTION;
        const fileExist = await CheckIFPathExists(fullfilepath).catch((err) => LogErrorMessage(err.message,err));
        if (fileExist){
            return resolve(true);
        }
        return resolve(false);
    });
}

/*Checkfs if the file at file_path location has no associated marker inside the in-memory storage for currently being created files
* never rejects only resolves (true/false) -> true if entry found*/
export async function CheckIfFileHasInMemoryMarker(file_path){
    return new Promise (async (resolve) => {
        if (LockedFiles.has(file_path)){
            return resolve(true);
        }
        return resolve(false);
    });
}

/*Returns how ready the file is to be used, 1 : fully ready, 2 : still being written, 3 : doesnt exist
* never rejects, on read errors just returns 3 as the default, 
* also removes leftovers from badly written files by removing file markers if in memory exists but not visa versa*/
export async function GetFileReadiness_RemoveOldMarker(static_file_path) {
    return new Promise(async (resolve, reject) => {
        // check for existence
        if (!await CheckIFPathExists(static_file_path)) {
            LogDebugMessage("Determined File readiness to be 3 since it doesnt exist")
            return resolve(3);
        }
        const HasInMemoryMarker = await CheckIfFileHasInMemoryMarker(static_file_path);
        const HasDiskMarker = await CheckIfFileHasFileMarker(static_file_path);

        if (HasInMemoryMarker) {
            LogDebugMessage("Determined File readiness to be 2 since it has an in-memory marker and they should normally get safely removed");
            return resolve(2);
        }
        if (HasDiskMarker) {
            // no memory marker but a disk marker means that write failed, remove it
            const response_message = await RemoveBadFileWithMarkers(static_file_path).catch((err) => LogErrorMessage(err.message, err));
            if (!response_message) {
                LogErrorMessage("Failed to remove file marker from from badly written file, this is not good, still continuing tho");
                // return 2 since re-creating it will just cause more issues
                return resolve(2);
            }
            // success removing it, return 3 indicating that it no longer exists
            return resolve(3);
        }

        // no markers found and file exists so its probably ready
        return resolve(1);
    });
}

/*Attempts to remove a badly written file together with its markers, rejects on failure*/
async function RemoveBadFileWithMarkers(static_file_path){
    return new Promise (async (resolve,reject) => {
        // file has file-marker but no in-memory marker meaning that its a leftover from a bad previos attempt, try removing it
        const file_marker_remove_response = await RemoveFile_WithErrors(static_file_path)
            .catch((err) => LogErrorMessage(err.message,err));
        const file_zip_remove_response = await RemoveFile_WithErrors(static_file_path+process.env.TEMPFILEMARKEREXTENTION)
            .catch((err) => LogErrorMessage(err.message,err));
        if (!file_zip_remove_response || !file_marker_remove_response){
            // failed to remove one of both
            return reject("failed to remove bad file with markers");
        }
        return resolve("successfully removed bad file together with its markers");
    });
}
