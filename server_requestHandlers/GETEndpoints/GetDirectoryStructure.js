// /GET/GetDirectoryStructure
import {
    CheckIFPathExists,
    CheckIfPathIsAllowed,
    GetFullPathFromRelativePath,
    GetUrlParameters, IsPathDirectory
} from "../../InputValidator.js";
import {LogErrorMessage} from "../../logger.js";
import fs from "node:fs";
import { promises as fsp } from "node:fs";
import {MIME_TYPES} from "../../variables/mimeTypes.js";

export async function HandleGetDirectoryStructure(req, res){
    return new Promise( async (resolve, reject) => {
        const urlParams = await GetUrlParameters(req.url).catch(
            (err) => LogErrorMessage(err.message, err)
        );
        if (!urlParams){
            return reject("Failed to get url parameters");
        }
        
        // get the val entry of url paramaters since thats where directory location resides
        const dirLocation = urlParams["val"];
        if (!dirLocation) {
            return reject("Url Paramter val not found, cant get directory location");
        }
        
        // get full path
        const fullDirLocation = GetFullPathFromRelativePath(dirLocation);
        
        // validate the path
        if (!await CheckIFPathExists(fullDirLocation)
            || !await CheckIfPathIsAllowed(fullDirLocation)
              || !await IsPathDirectory(fullDirLocation).catch((err) => LogErrorMessage(err.message, err))){
            return reject("Path validation failed");
        }
        
        // read directory
        const dir = await fsp.readdir(fullDirLocation).catch(
            (err) => LogErrorMessage(err.message, err)
        );
        if (!dir){
            return reject("Failed to read directory");
        }
        
        // write correct json head
        res.writeHead(200, {"Content-Type": MIME_TYPES.json});

        // normalize directory path to allow for adding entries to the end
        const normalizedDirectoryPath = (fullDirLocation.endsWith("/") || fullDirLocation.endsWith("\\"))
            ? fullDirLocation : (fullDirLocation + "/");
        
        // build the directory with proper types (directory/file)
        let DirectoryStructure = [];
        for (const i in dir) {
            const directoryEntry = dir[i];
            const FullEntryPath = normalizedDirectoryPath + directoryEntry;
            const fileStats = await fsp.lstat(FullEntryPath).catch(
                (err) => LogErrorMessage(err.message,err)
            );
            console.log(fileStats);
            
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

        // Write content as json
        const jsonContent = JSON.stringify(DirectoryStructure);
        res.write(jsonContent);

        // end early since its all sync
        res.end();
        return resolve("Successfully wrote directory structure to res");
    });
}