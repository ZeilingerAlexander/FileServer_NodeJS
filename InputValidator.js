/*Gets the full validated path for the provided url, checks if it is valid (under static dir, and existing) then returns it,
 rejects if not found or path traversal detectd*/
export async function GetFullValidatedPath(url){
    return new Promise(async (resolve, reject) => {
        // Get Full path
        const paths = [process.env.STATIC_PATH.toString(), url.toString()];
        const filePath = path.join(...paths);

        // Validate path, and check against traversal
        const pathTraversal = !filePath.startsWith(process.env.STATIC_PATH);
        const exists = await CheckIFPathExists(filePath);

        if (exists && !pathTraversal){
            return resolve(filePath);
        }
        else if (!exists){
            return reject(`Path doesnt exist ${filePath}`);
        }
        else{
            return reject(`Path traversal detected ${filePath}`);        }
    });
}