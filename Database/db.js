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
