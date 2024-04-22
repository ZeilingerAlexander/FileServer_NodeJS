// The ids inside the database for the access type entries
import {AddLogEntry} from "./db.js";
import {LogErrorMessage} from "../logger.js";

const AccessTypeIDS = {
    "create_auth_token" : 1,
    "login" : 2,
}

/*Logs creating auth token for provided id, never rejects even on error*/
export async function LogCreateAuthToken(ip, userid){
    return new Promise (async (resolve,reject) => {
        if (!ip || !userid){
            return resolve("Ip and userid cant be empty, not continuing to log creating auth token, ignoring...");
        }
        
        const complete_message = await AddLogEntry("Created auth Token for user", ip, userid, null, AccessTypeIDS.create_auth_token).catch(
            (err) => LogErrorMessage(err.message, err));
        if (!complete_message){
            return resolve("Adding Log Entry failed, ignoring...");
        }
        return resolve("Completed Adding Log Entry for auth token");
    });
}