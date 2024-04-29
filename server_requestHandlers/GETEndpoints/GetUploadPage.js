/*Handles getting the upload page*/
import {HandleGetFile} from "../FileHandlers.js";
import {LogErrorMessage} from "../../logger.js";

export async function HandleGetUploadPage(req, res){
    return new Promise (async (resolve,reject) => {
        req.url = process.env.UPLOADPAGE_HTML_RELATIVEPATH;
        const resultmsg = await HandleGetFile(req, res).catch((err) => LogErrorMessage(err.message,err));
        if(!resultmsg){
            return reject("Failed to handle get upload page");
        }
        return resolve("Finished handling get upload page");
    });
}