import * as mysql from "mysql2";

/*Creates the DB Context from the default values provided in the env file
* resolves with the connection or rejects if it fails*/
export async function CreateDbContext(){
    return new Promise(async (resolve,reject) => {
        let con = mysql.createConnection({
            
        })
    });
}