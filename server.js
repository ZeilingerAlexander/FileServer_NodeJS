// the node server
import * as http from "http";
import {HandleQuery} from "./server_requestHandlers/QueryHandlers.js";
import {IsRelativePathFile} from "./InputValidator.js";
import {HandleGetFile, HandleNotFound} from "./server_requestHandlers/FileHandlers.js";
import {HandleGetDirectoryNavigator} from "./server_requestHandlers/DirectoryHandlers.js";
import {LogDebugMessage, LogErrorMessage} from "./logger.js";
import {HandleAuthorizationOnRequest} from "./Authorization/auth.js";

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
    
    // Handle authentication, return if authentication fails
    const authorization_success_message = await HandleAuthorizationOnRequest(req, res).catch(
        (err) => LogErrorMessage("Authorization failed",err)
    );
    if (!authorization_success_message){
        return;
    }
    
    // Handle A Query Request on /GET/, /POST/, etc
    if (req.url.startsWith("/GET/") || req.url.startsWith("/POST/")){
            const complete_message = await HandleQuery(req, res).catch(
                (err) => LogErrorMessage(err.message, err)
            );
            if (complete_message){
                return resolve("Handling query completed successfully", complete_message);
            }
            else{
                return reject("Handling query failed");
            }
    }
    
    if (req.method === "GET"){
        await on_ServerGetRequest(req, res).catch(
            (err) => LogErrorMessage("Handling Server Get Request failed" + err.message, err)
        ).then(
            (msg) => LogDebugMessage("Handling Server Get Request completed " + msg)
        );
    }
    else if (req.method === "POST"){
        await on_ServerPostRequest(req, res).catch(
            (err) => LogErrorMessage("Handling Server Post Request failed" + err.message, err)
        ).then(
            (msg) => LogDebugMessage("Handling Server Post Request completed " + msg)
        );
    }
}

/*Gets called no post request, handles it depending on the request*/
async function on_ServerPostRequest(req,res){
    return new Promise(async (resolve,reject) => {
        return reject("Not implemented");
    });
}

/*Gets called on every server get request
* Handles calling the appropiate handlers depending on the request*/
async function on_ServerGetRequest(req,res){
    return new Promise(async (resolve, reject) => {
        // Request is a file/directory get request, so check the path
        // Request could also be something else but nothing is configured above
        // On Request error return 404 Page
        const complete_message = await HandleGetContent(req, res).catch(
            async (err) => {
                await LogErrorMessage(err.message, err);
                await HandleNotFound(req, res);
            })
        if (complete_message){
            return resolve("Handling Get content completed ", complete_message);
        }
        else{
            return reject("Handling Get content failed");
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