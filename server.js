// the node server
import * as http from "http";

/*Starts the node server*/
export async function StartServer (){
    return new Promise(async resolve => {
        http.createServer(on_ServerRequest);
        resolve("Successfully started server");
    });
}

async function on_ServerRequest(req, res){
    
}