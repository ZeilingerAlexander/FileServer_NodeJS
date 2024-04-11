// Handles interaction with directories

/*Handles getting the Directory Navigator page, call this whenever user goes to directory*/
import {HandleGetFile} from "./FileHandlers.js";

export async function HandleGetDirectoryNavigator(req, res){
    return new Promise( async (resolve, reject) => {
        // exprect the directory navigator to exist under the provided directory in env
        // if returning it doesnt work reject
        req.url = process.env.DIRECTORYNAVIGATOR_HTML_RELATIVEPATH;
        const success_message = await HandleGetFile(req, res).catch(
            (err) => console.log(err)
        );
        if (success_message){
            return resolve("Successfully got Directory Navigator");
        }
        else{
            return reject("Failed to get Directory Navigator");
        }
    });
}