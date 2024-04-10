import * as path from "path";
import {promises as fsp} from "fs";

// ...

/*Gets the full path for the provided relative path by combining the env static path with relative path,
* THIS DOES NOT VALIDATE THE PATH*/
export function GetFullPathFromRelativePath(relativePath){
    return path.join(process.env.STATIC_PATH.toString(), relativePath.toString());
}

/*checks if the provided relative path is a directory
* rejects if path is invalid or traversal was attempted
* resolves true if path points to a valid file, false if directory*/
export async function IsRelativePathFile(relativePath){
    return new Promise( async (resolve, reject) => {
        const contentPath = GetFullPathFromRelativePath(relativePath);

        if (!contentPath.startsWith(process.env.STATIC_PATH)){
            return reject("Path Traversal detected");
        }
        if (!CheckIFPathExists(contentPath)){
            return reject("Path doesnt exist");
        }
        const isFile = await IsPathFile(contentPath).catch(
            (err) => console.log(err)
        )
        if (isFile == null){
            return reject("Failed to get File");
        }
        if (isFile){
            return resolve(true);
        }
        else {
            return resolve(false);
        }
    });
}


/*Checks if the provided path is a file, rejects if not found*/
async function IsPathFile(path){
    return new Promise(async (resolve, reject) => {
        const fileStats = await fsp.lstat(path).catch((err) => console.log(err));
        if (!fileStats){
            return reject("failed to get filestats");
        }
        return resolve(fileStats.isFile() ? true : false);
    });
}



/*Checks if a given path is either a file or directory*/
async function CheckIFPathExists(path){
    return new Promise(async (resolve, reject) => {
        const stats = await fsp.lstat(path).catch((err) => console.log(err));
        if (!stats){return resolve(false);}
        if (!stats.isFile() && !stats.isDirectory()){
            return resolve(false);
        }
        return  resolve(true);
    });
}