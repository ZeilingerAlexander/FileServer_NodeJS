/*Handles The Get Public Resource Request*/
import {
    CheckIFPathExists,
    GetFullPathFromRelativePath,
    GetUrlParameters,
    IsPathDirectory
} from "../../InputValidator.js";
import {LogErrorMessage} from "../../logger.js";
import {HandleGetFile} from "../FileHandlers.js";
import {HandleSimpleResultMessage} from "../../server.js";

export async function HandleGetPublicResource(req,res){
    return new Promise (async (resolve,reject) => {
        const urlParams = await GetUrlParameters(req.url).catch(
            (err) => LogErrorMessage(err.message, err)
        );
        if (!urlParams){
            await HandleSimpleResultMessage(res, 405, "Bad URL Parameters");
            return reject("Failed to get url parameters");
        }

        // get the val entry of url paramaters since thats where directory location resides
        let dirLocation = urlParams["val"];
        if (!dirLocation) {
            await HandleSimpleResultMessage(res, 405, "Bad URL Parameters");
            return reject("Url Paramter val not found, cant get directory location");
        }
        
        const PublicResourcesStaticPath = GetFullPathFromRelativePath(process.env.PUBLICRESOURCES_RELATIVEPATH.toString());
        const RequestedDirectoryFullPath = GetFullPathFromRelativePath(process.env.PUBLICRESOURCES_RELATIVEPATH.toString() + dirLocation);
        
        // validate against path traversal
        if (!RequestedDirectoryFullPath.startsWith(PublicResourcesStaticPath)){
            await HandleSimpleResultMessage(res, 405, "Bad Request Headesr");
            return reject("Path Traversal Detected and rejected");
        }
        
        // Handle Getting File if exists and not directory
        if (!await CheckIFPathExists(RequestedDirectoryFullPath) || await IsPathDirectory(RequestedDirectoryFullPath)){
            await HandleSimpleResultMessage(res, 404,"Not found or directory");
            return reject("File doesnt exist or is directory");
        }
        req.url = process.env.PUBLICRESOURCES_RELATIVEPATH.toString() + dirLocation;
        const response_message = await HandleGetFile(req, res).catch((err) => LogErrorMessage(err.message,err));
        if (!response_message){
            await HandleSimpleResultMessage(res, 500, "Internal Server Error");
            return reject("Failed to Handle Getting file");
        }
        return resolve("Completed Handling getting public resource file");
    });
}