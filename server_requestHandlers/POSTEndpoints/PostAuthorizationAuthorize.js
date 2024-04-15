
/*Handles the authorization post request, returns reject on invalid credentials*/
export async function HandleAuthorizationOnPost(req,res){
    return new Promise(async (resolve,reject) => {
        res.writeHead(200, {"Set-Cookie" : "Authorization=test; SameSite=Lax;Path=/"});
        res.end();
        resolve("test-ignore");
    });
}

// TODO : Acutall implement a db strucutre for this
// TODO : automaticly expire old cookies for that user if a new login is detected
// TODO : add logout functionality to also expire token