import fs from "fs";
import path from "path";
import {WriteFiles} from "../../FileInteractions/FileHandler.js";

export async function HandlePostUploadFile(req, res) {
    return new Promise(async (resolve,reject) => {
        console.log(req.headers);
        console.log(req);

        console.log(await WriteFiles(req));
        res.end();
        return;
    });
}