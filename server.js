// the node server
import * as http from "http";
import {HandleGetQuery} from "./server_requestHandlers/QueryHandlers.js";
import {IsRelativePathFile} from "./InputValidator.js";
import {HandleGetFile, HandleNotFound} from "./server_requestHandlers/FileHandlers.js";
import {HandleGetDirectoryNavigator} from "./server_requestHandlers/DirectoryHandlers.js";
import {LogDebugMessage, LogErrorMessage} from "./logger.js";

/*Starts the node server*/
export async function StartServer (){
    return new Promise(async resolve => {
        const server = http.createServer(on_ServerRequest);
        // start server
        server.listen(process.env.PORT);
        resolve(`Successfully started server on  http://127.0.0.1:${process.env.PORT}/`);
    });
}

/*Gets called on any server request*/
async function on_ServerRequest(req, res){
    LogDebugMessage(`Got Request ${req.method} ${req.url}`);
    if (req.method === "GET"){
        await on_ServerGetRequest(req, res).catch(
            (err) => LogErrorMessage("Handling Server Get Request failed" + err.message, err)
        ).then(
            (msg) => LogDebugMessage("Handling Server Get Request completed " + msg)
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
                (err) => LogErrorMessage(err.message, err)
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
            // On Request error return 404 Page
            const complete_message = await HandleGetContent(req, res).catch(
                async (err) => {
                    await LogErrorMessage(err.message, err);
                    await HandleNotFound(req, res);
                }
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
            (err) => LogErrorMessage(err.message, err)
        );
        if (isFile == null){
            return reject("Path Validation Failed");
        }
        if (isFile){
            const complete_message = await HandleGetFile(req, res).catch(
                (err) => LogErrorMessage(err.message, err)
            );
            if (!complete_message){
                return reject("Handling Getting File Failed");
            }
            else{
                return resolve("Handling Getting File Completed ", complete_message);
            }
        }
        else {
            const complete_message = await HandleGetDirectoryNavigator(req, res).catch(
                (err) => LogErrorMessage(err.message, err)
            )
            if (!complete_message){
                return reject("Handling Getting Directory Navigator failed");
            }
            else{
                return resolve("Handling Getting Directory Navigator Completed ", complete_message);
            }
        }
    });

}