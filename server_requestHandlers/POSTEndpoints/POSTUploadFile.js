import fs from "fs";
import path from "path";
import {WriteFile} from "../../FileInteractions/FileHandler.js";

export async function HandlePostUploadFile(req, res) {
    return new Promise(async (resolve,reject) => {
        const lineDelimiter = 10;

        console.log(req.body);
        console.log(req.headers);
        console.log(req);

        let totalLength = 0;
        
        console.log(await WriteFile(req));
        res.end();
        return;
    });
}