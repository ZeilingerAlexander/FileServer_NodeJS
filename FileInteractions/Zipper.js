import archiver from "archiver";
import {CheckIFPathExists, GetAllFilePathsInDirectory} from "../Validator.js";
import {promises as fsp} from "fs";
import * as fs from "fs";
import * as path from "path";
import {LogDebugMessage, LogErrorMessage} from "../logger.js";
import {RemoveFile_WithErrors} from "./FileHandler.js";
import {HandleSimpleResultMessage} from "../server.js";

// ...

// will contain files currently being zipped by zipper
let Zipper_FilesCurrentlyBeingZipped = new Set();

/*Zips the Provided Directory to the provided output path, resolves when complete, rejects if any values empty or out_path already existing
*  creates a temp file while the file is not finished zipping, removes it on completion*/
export async function ZipDirectoryToPath(dir_to_zip, out_path){
    return new Promise (async (resolve,reject) => {
        if (!dir_to_zip || !out_path || await CheckIFPathExists(out_path)){
            return reject("Bad Input");
        }

        const out = fs.createWriteStream(out_path);
        const archive = archiver.create("zip", {
            zlib : {level: 1}
        });

        // on close remove marker + resolve, or reject if marker removing fails
        archive.on("close", async function (){
            // try to remove the marker up to five times since zipping might have been costly, 
            // if after that it still fails to remove just give up and reject
            let marker_remove_retry_attempts = 5;
            let marker_remove_retry_timout_between_attempts = 500;

            // will be defined on remove success
            let marker_remove_response = undefined;

            while (marker_remove_retry_attempts > 0 && !marker_remove_response){
                marker_remove_response = await Zipper_RemoveTempFileMarker(out_path).catch((err) => LogErrorMessage(err.message,err));
                if (marker_remove_response){
                    // success
                    break;
                }
                // no success, wait timeout and retry if enough attempts remaining
                const delay = ms => new Promise(resolve => setTimeout(resolve, ms))
                await delay(marker_remove_retry_timout_between_attempts)
                marker_remove_retry_attempts = marker_remove_retry_attempts - 1;
            }

            // if marker remove response still undefined give up and reject
            if (!marker_remove_response){
                return reject("Failed to remove marker, giving up");
            }

            return resolve("Successfully saved to zip file");
        });

        // on error remove zip and marker + reject
        archive.on("error", async function (err){
            LogErrorMessage(err.message,err);

            // remove zip file, if that works remove the old marker for it
            const remove_response_msg = await RemoveFile_WithErrors(out_path).catch((err) => LogErrorMessage(err.message,err));
            if (remove_response_msg){
                // also remove marker but keep it so further reads will know that it points to a bad zip file,
                // it doesnt matter if it fails or not since its just the marker and we reject anyways
                await Zipper_RemoveTempFileMarker(out_path).catch((err) => LogErrorMessage(err.message,err));
            }
            return reject("Failed to compress to zip file");
        });
        
        archive.on("warning", async function (warn) {
            LogDebugMessage(`Received warning from zip-archiver (archiver) : ${warn}`);
        });

        // create marker before piping to output since that will already create the zip file which might or might not fail
        const zipper_create_respone = await Zipper_CreateTempFileMarker(out_path).catch((err) => LogErrorMessage(err.message, err));
        if (!zipper_create_respone){
            return reject("Failed to create temp file marker");
        }
        
        try{
            archive.pipe(out);
        }
        catch (err){
            LogErrorMessage(err.message,err);
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
            const stats = await fsp.stat(file).catch((err) => LogErrorMessage(err.message,err));
            if (stats && stats.isFile()){
                const relativePath = path.relative(dir_to_zip, file);
                try{
                    archive.append(fs.createReadStream(file), {name : relativePath});
                }
                catch (err){
                    LogErrorMessage(err.message,err);
                }
            }
        }


        await archive.finalize();
    });
}

/*Creates a temp file marker for the zip file residing on provided path, this marker indicates that the file is currently being written
also adds the marker to temp paths, only adds it if its not already added (this may cause conflicts so check beforehand if it exists)
* rejects on error*/
async function Zipper_CreateTempFileMarker(zipPath){
    return new Promise(async (resolve,reject) => {
        const full_path = zipPath+process.env.ZIPPER_TEMPFILEMARKEREXTENTION;
        fs.writeFile(full_path, "", err => {
            if (err){
                LogErrorMessage(err.message, err);
                return reject("Failed to create temp file");
            }
            if (!Zipper_FilesCurrentlyBeingZipped.has(zipPath)){
                Zipper_FilesCurrentlyBeingZipped.add(zipPath);
            }
            else{
                LogDebugMessage("Zip path already existed in memory storage of files already being created, " +
                    "make sure to implement a check beforehand since this may cause issues");
            }
            return resolve("Wrote file successfully");
        });
    });
}

/*Removes the temp file marker for the zip file residing in the provided path, removing the marker indicates that the file was written without errors*/
async function Zipper_RemoveTempFileMarker(zipPath){
    return new Promise (async (resolve,reject) => {
        const fullFilePath = zipPath + process.env.ZIPPER_TEMPFILEMARKEREXTENTION;

        // remove from in-memory storage
        if (Zipper_FilesCurrentlyBeingZipped.has(zipPath)){
            Zipper_FilesCurrentlyBeingZipped.delete(zipPath);
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
export async function Zipper_CheckIfFileHasFileMarker(file_path){
    return new Promise (async (resolve) => {
        const fullfilepath = file_path+process.env.ZIPPER_TEMPFILEMARKEREXTENTION;
        const fileExist = await CheckIFPathExists(fullfilepath).catch((err) => LogErrorMessage(err.message,err));
        if (fileExist){
            return resolve(true);
        }
        return resolve(false);
    });
}

/*Checkfs if the file at file_path location has no associated marker inside the in-memory storage for currently being created files
* never rejects only resolves (true/false) -> true if entry found*/
export async function Zipper_CheckIfFileHasInMemoryMarker(file_path){
    return new Promise (async (resolve) => {
        if (Zipper_FilesCurrentlyBeingZipped.has(file_path)){
            return resolve(true);
        }
        return resolve(false);
    });
}

/*Returns how ready the file is to be used, 1 : fully ready, 2 : still being written, 3 : doesnt exist
* never rejects, on read errors just returns 3 as the default, also removes leftovers from badly written files by removing file markers if in memory exists but not visa versa*/
export async function Zipper_GetFileReadyness_RemoveOldMarkers(static_file_path) {
    return new Promise(async (resolve, reject) => {
        // check for existance
        if (!await CheckIFPathExists(static_file_path)) {
            LogDebugMessage("Determined File readyness to be 3 since it doesnt exist")
            return resolve(3);
        }
        const HasInMemoryMarker = await Zipper_CheckIfFileHasInMemoryMarker(static_file_path);
        const HasDiskMarker = await Zipper_CheckIfFileHasFileMarker(static_file_path);

        if (HasInMemoryMarker) {
            LogDebugMessage("Determined File readyness to be 2 since it has an in-memory marker and they should normally get safely removed");
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
        const file_zip_remove_response = await RemoveFile_WithErrors(static_file_path+process.env.ZIPPER_TEMPFILEMARKEREXTENTION)
            .catch((err) => LogErrorMessage(err.message,err));
        if (!file_zip_remove_response || !file_marker_remove_response){
            // failed to remove one of both
            return reject("failed to remove bad file with markers");
        }
        return resolve("successfully removed bad file together with its markers");
    });
}
