import * as mysql from "mysql2";
import {LogDebugMessage, LogErrorMessage} from "../logger.js";

let dbcontext;

/*Creates the dbcontext ot mysql server from the provided env file
* rejects if connection fails, resolves if successful*/
export async function CreateDbContext(env){
    return new Promise(async (resolve,reject) => {
        let con = mysql.createConnection({
            host : env.MYSQLHOST,
            user : env.MYSQLUSERNAME,
            password : env.MYSQLPASSWORD
        });

        con.connect(function(err) {
            if (err) {
                LogErrorMessage("Failed to open connection to mysql server", err);
                return reject("Failed to open connection");
            }
            LogDebugMessage("Mysql Server connected");
        });
        dbcontext = con;
        return resolve("Successfully created mysql connection");
    });
}

/*Checks if the provided login info is a valid entry in the database (password is hashed)*/
export async function IsLoginValid(username, passwordHash){
    return new Promise(async (resolve,reject) => {
        if (!username || !passwordHash){
            return reject("username or password was empty");
        }
        
        const exampleLogonuser = "test";
        const exampleLogonpass = "pass";
        
        const query = `SELECT id FROM authentication.user WHERE name = ? AND passkey = ? LIMIT 1`
        const row = await dbcontext.promise().query(query, [exampleLogonuser,exampleLogonpass]);
        const data = row[0];
        
        return resolve(data.length > 0);
    });
}

/*Generates an authentication token for the provided userid and adds it to the database marked as NOT-expired*/
export async function GenerateAuthenticationToken(userid){
    return new Promise(async (resolve,reject) => {
        // TODO : implement
        
    });
}

/*Expires all authentication for the provided user id*/
export async function ExpireAllAuthenticationTokensForUser(userid){
    return new Promise(async (resolve,reject) => {
        // TODO : implement
    });
}

/*Adds a log entry with the provided data*/
export async function AddLogEntry(message, ip, userid_nullable, accessToken_nullable, accessType_nullable){
    return new Promise(async (resolve,reject) => {
        if (!message || !ip){
            return reject("Message and ip cant be empty");
        }
        const query = "INSERT INTO authentication.accesslog (time_creation,message,ip,user,accesstoken,accesstype)" +
            "VALUES (?,?,?,?,?,?)";
        const complete_message = await dbcontext.promise().query(query, [Date.now(), message,ip,userid_nullable,accessToken_nullable,accessType_nullable]).catch(
            (err) => LogErrorMessage(err.message,err));
        if (!complete_message){
            return reject("Inserting Access log entry failed");
        }


        return resolve("Inserted Access log entry completed");
    });
}

