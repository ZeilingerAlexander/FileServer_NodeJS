/**/
import {
    CheckIFPathExists, GetFilenameFromZipParsedFilename,
    GetSingleURLParameter_ReturnBadRequestIfNotFound,
    GetZipPathUserDirectory_ForUser
} from "../../Validator.js";
import {LogErrorMessage} from "../../logger.js";
import * as path from "path";
import {CheckIfFileHasAnyMarker_OrFileIsMarker} from "../../FileInteractions/FileLocker.js";
import {HandleSimpleResultMessage} from "../../server.js";
import {HandleNotFound, WriteFileFromStaticPathToResult} from "../../FileInteractions/FileHandler.js";

export async function HandleRetrieveZippedFile (req,res){
    return new Promise (async (resolve,reject) => {
        if(req.accessLevel < 2){
            return reject("Too low access level to get zipped file");
        }

        let filename = await GetSingleURLParameter_ReturnBadRequestIfNotFound(req, res, "val").catch(
            (err) => LogErrorMessage(err.message,err));
        if (!filename){
            return reject("Failed to get filename from url params");
        }
        
        // get full file path
        const userZipDirPath=  await GetZipPathUserDirectory_ForUser(req.userID).catch((err) => LogErrorMessage(err.message,err));
        const fullZipFilePath = path.join(userZipDirPath, filename);
        
        // validate against path traversal
        if (!fullZipFilePath.startsWith(userZipDirPath)){
            return reject("path traversal detected");
        }
        
        // check if file exists and is ready
        if (!await CheckIFPathExists(fullZipFilePath)){
            await HandleNotFound(req,res);
            return resolve("zip file not found, still resolving since we handled response");
        }
        else if (await CheckIfFileHasAnyMarker_OrFileIsMarker(fullZipFilePath)){
            await HandleSimpleResultMessage(res, 503, "file not ready");
            return resolve("zip file not ready, still resolving since we handled response");
        }
        
        const zipFileName = GetFilenameFromZipParsedFilename(fullZipFilePath);
        
        // send file with modified file name
        res.writeHead(202, {"Content-Type" : "application/x-zip","Content-Disposition" : `attachment; filename="${zipFileName}"`});
        const responsemsg = await WriteFileFromStaticPathToResult(res, fullZipFilePath).catch((err) => LogErrorMessage(err.message,err));
        if (!responsemsg){
            return reject("Failed to write zip file from static path to res");
        }
        return resolve("successfully wrote zip file from static path to res");
    });
}