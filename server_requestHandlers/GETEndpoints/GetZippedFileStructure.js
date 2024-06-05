/*Handles getting the zipped file structure for the current user*/
import {
    CheckIFPathExists, CheckIfPathIsAllowed, GetDirectoryStructure, GetFilenameFromZipParsedFilename,
    GetFullPathFromRelativePath,
    GetUrlParameters,
    GetValidatedUserRelativePathFromRequestPath, GetZipPathUserDirectory_ForUser, IsPathDirectory
} from "../../Validator.js";
import {LogErrorMessage} from "../../logger.js";
import {MIME_TYPES} from "../../variables/mimeTypes.js";
import {CreateDirectory} from "../../FileInteractions/FileHandler.js";
import * as path from "path";
import {CheckIfFileHasAnyMarker_OrFileIsMarker} from "../../FileInteractions/FileLocker.js";


export async function HandleGetZippedFileStructure(req,res){
    return new Promise (async (resolve,reject) => {
        if(req.accessLevel < 2){
            return reject("Too low access level to get zipped file structure");
        }
        
        // get zip directory path
        const zip_directory_location = await GetZipPathUserDirectory_ForUser(req.userID);
        if (!await CheckIFPathExists(zip_directory_location)){
            CreateDirectory(zip_directory_location);
        }
        
        const dirStructure = await GetDirectoryStructure(zip_directory_location).catch((err) => LogErrorMessage(err.message,err));
        if (!dirStructure){
            return reject("Failed to get directory structure");
        }
        
        console.log(dirStructure);
        let ZipDirectoryStructure = [
            // Object
            /*
            fullFileName : the "real" file name of the zipped file
            ParsedFileName : the parsed file name of the zipped file, this is the user-friendly display for it
            size : file size
            lastModified : last modified time
            creationTime : creation time
            isReady : if the file is ready to be downloaded
            */
        ];
        for (const dirStructureKey in dirStructure) {
            const dirStructureEntry = dirStructure[dirStructureKey];
            const fullDirectoryEntryFilePath = path.join(zip_directory_location, dirStructureEntry.name)
            let file_ready = true;
            
            // if its a directory, skip
            if(dirStructureEntry.Directory){
                continue;
            }
            
            // check if the file is ready, if not mark it as not ready and if its a marker skip it entirely
            if(await CheckIfFileHasAnyMarker_OrFileIsMarker(fullDirectoryEntryFilePath)){
                if(dirStructureEntry.name.endsWith(process.env.TEMPFILEMARKEREXTENTION)){
                    // is a marker, so skip
                    continue;
                }
                file_ready = false;
            }
            
            ZipDirectoryStructure.push({
               fullFileName : dirStructureEntry.name,
                ParsedFileName : GetFilenameFromZipParsedFilename(dirStructureEntry.name),
                size : dirStructureEntry.size,
                lastModified : dirStructureEntry.lastModified,
                creationTime : dirStructureEntry.creationTime,
                isReady : file_ready
            });
        }


        // write correct json head
        res.writeHead(200, {"Content-Type": MIME_TYPES.json});

        // Write content as json
        const jsonContent = JSON.stringify(ZipDirectoryStructure);
        res.write(jsonContent);

        // end early since its all sync
        res.end();
        return resolve("Successfully wrote zip directory structure to res");
    });
}