// Handlers for queries (not files/dirs)
/*Handles a /GET/ query*/
export async function HandleGetQuery(req, res){
    return new Promise(async (resolve, reject) => {
        reject("test");
    });
}