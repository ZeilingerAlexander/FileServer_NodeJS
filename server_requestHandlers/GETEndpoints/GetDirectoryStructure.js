// /GET/GetDirectoryStructure
import {
    CheckIFPathExists,
    CheckIfPathIsAllowed, GetDirectoryStructure,
    GetFullPathFromRelativePath,
    GetUrlParameters, GetValidatedUserRelativePathFromRequestPath, IsPathDirectory
} from "../../Validator.js";
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
        let dirLocation = urlParams["val"];
        if (!dirLocation) {
            return reject("Url Paramter val not found, cant get directory location");
        }
        
        // if the accessLevel is < 4 (no read access to all) append the user directory path in front and validate the access over it
        if (req.accessLevel < 4){
            const validatedDirectoryLocation = await GetValidatedUserRelativePathFromRequestPath(dirLocation, req.userID).catch((err) => LogErrorMessage(err.message,err));
            if (!validatedDirectoryLocation){
                return reject("Failed to validate request path");
            }
            dirLocation = validatedDirectoryLocation;
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
        const DirectoryStructure = await GetDirectoryStructure(fullDirLocation, true);
        
        // write correct json head
        res.writeHead(200, {"Content-Type": MIME_TYPES.json});

        // Write content as json
        const jsonContent = JSON.stringify(DirectoryStructure);
        res.write(jsonContent);

        // end early since its all sync
        res.end();
        return resolve("Successfully wrote directory structure to res");
    });
}