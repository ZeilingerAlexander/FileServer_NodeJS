import * as mysql from "mysql2";
import {LogDebugMessage, LogErrorMessage} from "../logger.js";
import {LogCreateAuthToken} from "./dblogger.js";
import {DoesDataMatchHash, GenerateNewAccesToken, GetPasswordHash} from "../Validator.js";
import {hash} from "bcrypt";

let dbcontext;
/* Cached Auth tokens includes the token stored in front-end cookie and db password hash
if both of those match we dont need to validate over crypto (the db is just to check if it changed)*/
let CachedAuthTokens = new Map();

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
        if (data.length > 0){
            // user exists, check if user has attempts remaining
            if (data[0].passwordAttemptsRemaining <= 0){
                // no attempts remaining, lock account and reject
                await LockUserAccount(data[0].id);
                return reject("Too many login attempts, account locked. Contact admin");
            }
            
            // user has attempts remaining, check if password is correct, if not down login attempts by 1 and reject
            if (await DoesDataMatchHash(password, data[0].passkey)){
                // correct login info, reset remaining attempts and resolve with id
                await ResetLoginAttempts(data[0].id);
                return resolve(data[0].id);
            }
            else{
                // bad login info, down attempts and reject
                await LowerLoginAttemptsByOne(data[0].id);
                return reject("Password doesnt match");
            }
        }
        
        // user doesnt exist
        return reject("user doesnt exist");
    });
}

/*Locks a users account by invalidating all auth tokens and setting account locked state to true
* does not reject on non-existing user id in database*/
async function LockUserAccount(userID){
    return new Promise (async (resolve,reject) => {
        if (!userID){
            return reject("no user id provided");
        }
        
        // expire all auth tokens
        await ExpireAllAuthenticationTokensForUser(userID);
        
        // lock user account
        const query = "UPDATE authentication.user SET locked = true WHERE id = ?;"
        await dbcontext.promise().query(query, [userID]).catch((err) =>
        LogErrorMessage(err.message, err));
        
        
        return resolve("locked user account");
    });
}

/*Generates an authentication token for the provided userid with the provided ip and adds it to the database marked as NOT-expired 
* resolves with the token if successful
* rejects if any parms empty*/
export async function GenerateAuthenticationToken(userid,ip){
    return new Promise(async (resolve,reject) => {
        if (!userid || !ip){ return reject("userid and ip cant be empty");}
        
        // Get the unhashed token for the client to use and store the hashed token inside the db
        const token = await GenerateNewAccesToken();
        const hashedToken = await GetPasswordHash(token);
        
        // insert token into db
        const query = "INSERT INTO authentication.accesstoken (token, expired, user,ip) " +
            "VALUES (?,?,?,?)";
        const complete_message = await dbcontext.promise().query(query, [hashedToken, false, userid,ip]).catch((err) => LogErrorMessage(err.message, err));
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

/*Downs users login attempts by 1, only rejects on no userid provided not on failed db query*/
async function LowerLoginAttemptsByOne(userID){
    return new Promise (async (resolve,reject) => {
        if (!userID){
            return reject("no userid provided");
        }
        
        // get login attempts, -1 them, set again
        
        const selectQuery = "SELECT passwordAttemptsRemaining FROM authentication.user WHERE id = ? LIMIT 1;";
        const row = await dbcontext.promise().query(selectQuery, [userID])
            .catch((err) => LogErrorMessage(err.message, err));
        const data = row[0];
        const attempts = data[0].passwordAttemptsRemaining
        
        const postQery = "UPDATE authentication.user SET passwordAttemptsRemaining = ? WHERE id = ?;"
        await dbcontext.promise().query(postQery, [attempts-1, userID])
            .catch((err) => LogErrorMessage(err.message, err));
        
        return resolve("Downed login attempts by 1");
    });
}

/*Resets the Login Attempts for the provided userid, only rejects on no user id*/
async function ResetLoginAttempts(userID){
    return new Promise (async (resolve,reject) => {
        if (!userID){
            return reject("no userid provided");
        }
        
        // reset to db default
        const query = "UPDATE authentication.user SET passwordAttemptsRemaining=default WHERE id = ?;"
        await dbcontext.promise().query(query, [userID])
            .catch((err) => LogErrorMessage(err.message, err));
        
        return resolve("Reset Login Attempts for user");
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
also checks the provided ip address against the one stored inside the ip column if not null, if null its ignored in the check
* rejects if any userid or token empty*/
export async function ValidateAuthToken(userid, token, ip){
    return new Promise (async (resolve,reject) => {
        if (!userid || !token){
            return reject("userid and token cant be empty");
        }
        
        const query = "SELECT token,ip FROM authentication.accesstoken " +
            "INNER JOIN authentication.user ON user=user.id " +
            "WHERE user = ? AND expired = ? AND locked = ?"
        const db_auth_token_row = await dbcontext.promise().query(query, [userid,false,false]).catch(
            (err) => LogErrorMessage(err.message,err));
        const data = db_auth_token_row[0];
        
        if (data.length === 0 || !data[0].token){
            // db error, ip is not important since it wont throw an error on null
            return resolve(false);
        }
        
        // Check if provided ip is not null, if so validate against db. on failure resolve with false
        if(ip != null && data[0].ip !== ip){
            return resolve(false);
        }
        
        // Check if cached data includes the token
        if (CachedAuthTokens.has(token)) {
            // Check if cached value matches the one of db
            if ((CachedAuthTokens.get(token) === data[0].token)) {
                // matches so we can assume that db value didnt change since its not expired from above query
                return resolve(true);
            } else {
                // doesnt match so remove from cached tokens
                CachedAuthTokens.delete(token);
            }
        }
        
        // if data matches against db cache the token and resolve true
        if (await DoesDataMatchHash(token, data[0].token)){
            CachedAuthTokens.set(token, data[0].token);
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

/*Generates the example uesrs (test1,test2) both have the password Muster123. test1 has access level 3 and test2 access level 6*/
export async function GenerateExampleUsers(){
    return new Promise (async (resolve) => {
        const passkey = await GetPasswordHash("Muster123");
        const query1 = `INSERT INTO authentication.user (name, passkey, accessLevel) VALUES(?,?,?)`;
        const query2 = `INSERT INTO authentication.user (name, passkey, accessLevel) VALUES(?,?,?)`;

        await dbcontext.promise().query(query1, ["test1", passkey, 3]).catch((err) => LogErrorMessage(err.message,err));
        await dbcontext.promise().query(query1, ["test2", passkey, 6]).catch((err) => LogErrorMessage(err.message,err));

        return resolve();
    });
}