import archiver from "archiver";
import {CheckIFPathExists, GetAllFilePathsInDirectory} from "./InputValidator.js";
import {promises as fsp} from "fs";
import * as fs from "fs";
import * as path from "path";
import {LogErrorMessage} from "./logger.js";
import {RemoveFile_WithErrors} from "./FileHandler.js";

// ...

// will contain files currently being zipped by zipper
let Zipper_FilesCurrentlyBeingZipped = [];


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

        // create marker before piping to output since that will already create the zip file which might or might not fail
        const zipper_create_respone = await Zipper_CreateTempFileMarker(out_path).catch((err) => LogErrorMessage(err.message, err));
        if (!zipper_create_respone){
            return reject("Failed to create temp file marker");
        }

        archive.pipe(out);

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
                archive.append(fs.createReadStream(file), {name : relativePath});
            }
        }

        archive.finalize();
    });
}

/*Creates a temp file marker for the zip file residing on provided path, this marker indicates that the file is currently being written
* rejects on error*/
async function Zipper_CreateTempFileMarker(zipPath){
    return new Promise(async (resolve,reject) => {
        fs.writeFile(zipPath+process.env.ZIPPER_TEMPFILEMARKEREXTENTION, "", err => {
            if (err){
                LogErrorMessage(err.message, err);
                return reject("Failed to create temp file");
            }
            return resolve("Wrote file successfully");
        });
    });
}

/*Removes the temp file marker for the zip file residing in the provided path, removing the marker indicates that the file was written without errors*/
async function Zipper_RemoveTempFileMarker(zipPath){
    return new Promise (async (resolve,reject) => {
        const fullFilePath = zipPath + process.env.ZIPPER_TEMPFILEMARKEREXTENTION;

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

/*Checks if the file pointing to the provided path is ready to be downloaded and doesnt have a marker, never rejects only resolves true/false*/
export async function Zipper_CheckIfFileISReady(file_path){
    return new Promise (async (resolve) => {
        const fileExist = await CheckIFPathExists(file_path+process.env.ZIPPER_TEMPFILEMARKEREXTENTION).catch((err) => LogErrorMessage(err.message,err));
        if (!fileExist){
            return resolve(true);
        }
        return resolve(false);
    });
}
