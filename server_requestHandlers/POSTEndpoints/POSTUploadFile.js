export async function HandlePostUploadFile(req, res) {
    return new Promise(async (resolve,reject) => {

        req.on('data', (chunk) => {
           console.log("Got data : ");
           console.log(typeof chunk);
           console.log(chunk);
        });

        req.on('end', () => {
            console.log("request end");
        });
        res.end();
    });
}