import * as mysql from "mysql2";
import {LogDebugMessage, LogErrorMessage} from "../logger.js";
import {LogCreateAuthToken} from "./dblogger.js";
import {GenerateNewAccesToken} from "../InputValidator.js";

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

/*Checks if the provided login info is a valid entry in the database (password is hashed)
* resolves with the user id if successful, RESOLVES(not rejects) with undefined if empty, 
* only rejects if username or password empty*/
export async function ValidateLogin(username, passwordHash){
    return new Promise(async (resolve,reject) => {
        if (!username || !passwordHash){
            return reject("username or password was empty");
        }
        
        const exampleLogonuser = "test";
        const exampleLogonpass = "pass";
        
        const query = `SELECT id FROM authentication.user WHERE name = ? AND passkey = ? LIMIT 1`
        const row = await dbcontext.promise().query(query, [exampleLogonuser,exampleLogonpass]);
        const data = row[0];
        
        if (data.length > 0){
            // valid login
            return resolve(data[0].id);
        }
        // invalid login
        return resolve(undefined);
    });
}

/*Generates an authentication token for the provided userid and adds it to the database marked as NOT-expired 
* resolves with the token if successful*/
export async function GenerateAuthenticationToken(userid){
    return new Promise(async (resolve,reject) => {
        if (!userid){ return reject("userid cant be empty");}
        
        const token = await GenerateNewAccesToken();
        
        // insert token into db
        const query = "INSERT INTO authentication.accesstoken (token, expired, user) " +
            "VALUES (?,?,?)";
        const complete_message = await dbcontext.promise().query(query, [token, false, userid]).catch((err) => LogErrorMessage(err.message, err));
        if (!complete_message){return reject("Failed to insert auth token into db");}
        
        return resolve(token);
    });
}

/*Expires all authentication for the provided user id, doesnt reject on failure*/
export async function ExpireAllAuthenticationTokensForUser(userid){
    return new Promise(async (resolve,reject) => {
        const query = "UPDATE authentication.accesstoken SET expired=true WHERE user=?";
        const complete_message = await dbcontext.promise().query(query, [userid]).catch((err) => LogErrorMessage(err.message,err));
        if (!complete_message){
            return resolve("Expiring Authentication failed, ignoring...");
        }
        return resolve("Expiring authentication completed");
    });
}

/*Adds a log entry with the provided data, rejects if message or ip are empty and/or inserting into db fails*/
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

