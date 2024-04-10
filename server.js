// the node server
import * as http from "http";
import {HandleGetQuery} from "./server_requestHandlers/QueryHandlers.js";
import {IsRelativePathFile} from "./InputValidator.js";
import {HandleGetFile} from "./server_requestHandlers/FileHandlers.js";

/*Starts the node server*/
export async function StartServer (){
    return new Promise(async resolve => {
        const server = http.createServer(on_ServerRequest);
        // start server
        server.listen(process.env.PORT);
        resolve(`Successfully started server on port ${process.env.PORT}`);
    });
}

/*Gets called on any server request*/
async function on_ServerRequest(req, res){
    console.log(`Got Request ${req.method} ${req.url}`);
    if (req.method === "GET"){
        await on_ServerGetRequest(req, res).catch(
            (err) => console.log("Handling Server Get Request failed", err.message)
        ).then(
            (msg) => console.log("Handling Server Get Request completed", msg.message)
        );
        
    }
}

/*Gets called on every server get request
* Handles calling the appropiate handlers depending on the request*/
async function on_ServerGetRequest(req,res){
    return new Promise(async (resolve, reject) => {
        // Check if request is a non-file/folder request, just a normal query request
        if (req.url.startsWith("/GET/")){
            const complete_message = await HandleGetQuery(req, res).catch(
                (err) => console.log(err)
            );
            if (complete_message){
                return resolve("Handling Get query completed successfully", complete_message);
            }
            else{
                return reject("Handling Get query failed");
            }
        }
        else{
            // Request is a file/directory get request, so check the path
            // Request could also be something else but nothing is configured above
            const complete_message = await HandleGetContent(req, res).catch(
                (err) => console.log(err)
            )
            if (complete_message){
                return resolve("Handling Get content completed ", complete_message);
            }
            else{
                return reject("Handling Get content failed");
            }
        }
    });
}

/*Gets called on server content request, checks if client wants a file or folder then calles the appropiate handler*/
async function HandleGetContent(req,res){
    return new Promise( async (resolve, reject) => {
        const isFile = await IsRelativePathFile(req.url).catch(
            (err) => console.log(err)
        );
        if (isFile == null){
            return reject("Path Validation Failed");
        }
        if (isFile){
            const complete_message = await HandleGetFile(req, res).catch(
                (err) => console.log(err)
            );
            if (!complete_message){
                return reject("Handling Getting File Failed");
            }
            else{
                return resolve("Handling Getting File Completed ", complete_message);
            }
        }
        else {
            
        }
    });

}