import * as mysql from "mysql2";
import {LogDebugMessage, LogErrorMessage} from "../logger.js";
import {LogCreateAuthToken} from "./dblogger.js";
import {DoesDataMatchHash, GenerateNewAccesToken, GetPasswordHash} from "../InputValidator.js";
import {hash} from "bcrypt";

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

/*Checks if the provided login info is a valid entry in the database (password is unhashed)
* resolves with the user id if successful, RESOLVES(not rejects) with undefined if empty, 
* only rejects if username or password empty*/
export async function ValidateLogin(username, password){
    return new Promise(async (resolve,reject) => {
        if (!username || !password){
            return reject("username or password was empty");
        }

        // Get passkey from database for provided username then validate over bcrypt
        const query = `SELECT * FROM authentication.user WHERE name = ? LIMIT 1`
        const row = await dbcontext.promise().query(query, [username]);
        const data = row[0];
        
        if (data.length > 0 && await DoesDataMatchHash(password, data[0].passkey)){
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
        
        // Get the unhashed token for the client to use and store the hashed token inside the db
        const token = await GenerateNewAccesToken();
        const hashedToken = await GetPasswordHash(token);
        
        // insert token into db
        const query = "INSERT INTO authentication.accesstoken (token, expired, user) " +
            "VALUES (?,?,?)";
        const complete_message = await dbcontext.promise().query(query, [hashedToken, false, userid]).catch((err) => LogErrorMessage(err.message, err));
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

/*Resolves true if authorization for first non-expired authentication token of provided user id matches provied auth token (not-hashed)
* rejects if any parms empty*/
export async function ValidateAuthToken(userid, token){
    return new Promise (async (resolve,reject) => {
        if (!userid || !token){
            return reject("userid and token cant be empty");
        }
        
        const query = "SELECT token FROM authentication.accesstoken WHERE user = ? AND expired = ?"
        const db_auth_token_row = await dbcontext.promise().query(query, [userid,false]).catch(
            (err) => LogErrorMessage(err.message,err));
        const data = db_auth_token_row[0];
        
        if (data.length > 0 && await DoesDataMatchHash(token, data[0].token)){
            return resolve(true);
        }
        return resolve(false);
    });
}

/*resolves with the authorization level for the provided user, resolves with -1 if user not found*/
export async function GetAccessLevelFromUserID(userID){
    return new Promise (async (resolve) => {
        
        const query = "SELECT accessLevel FROM authentication.user WHERE id = ?"
        const db_user_row = await dbcontext.promise().query(query, [userID]).catch(
            (err) => LogErrorMessage(err.message,err));
        const data = db_user_row[0];
        
        if (data.length > 0 && data[0].accessLevel){
            return resolve(data[0].accessLevel);
        }
        return resolve(false);
    });
}