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

        // no validation cuz test
        const boundary = req.headers["content-type"].split("boundary=")[1];
        console.log(await WriteFile(req,boundary));
        res.end();
        return;
        req.on("data", chunk => {
                let buffer = Buffer.from(chunk);
                let values = buffer.values();

                let strings = [];
                let currentString = "";
                for(let i = 0; i < buffer.length; i++){
                    let code = values.next().value;
                    // check if delimiter
                    if (code === lineDelimiter){
                        // delimiter so append to strings and continue
                        strings.push(currentString);
                        console.log(currentString);
                        currentString = "";
                    }
                    else{
                        // not delimiter so upgrade current string
                        let char = String.fromCharCode(code);
                        currentString += char;
                    }
                }
                totalLength += buffer.length;
               // console.log(strings);
            // console.log(chunk);
            // console.log(totalLength);

        });

        // const examplePath = path.join(process.env.STATIC_PATH,"examplePath.zip");
        // req.pipe(fs.createWriteStream(examplePath));

        res.end();
    });
}