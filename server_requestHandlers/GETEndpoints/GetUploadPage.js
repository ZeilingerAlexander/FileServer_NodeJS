/*Handles getting the upload page*/
import {LogErrorMessage} from "../../logger.js";
import {HandleGetFile} from "../HandleGetFile.js";

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