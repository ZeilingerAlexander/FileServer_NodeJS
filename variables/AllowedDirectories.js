import {GetFullPathFromRelativePath} from "../InputValidator.js";
import * as path from "path";

/*Array of special Directory Paths that traversal validation will not be applied to*/
export const AllowedDirectories = [];

/*Array of special Relative Directory Paths that traversal validation will not be applied to */
const AllowedRelativeDirectories = [
    "DirectoryNavigator",
    "Upload",
    "static"
]

/*Loads the Allowed Directories Array from the Allowed Relative Directories Array*/
export async function LoadSpecialDirectories(){
    return new Promise((resolve) => {
        for (const i in AllowedRelativeDirectories) {
            // Add WorkingDir + path
            AllowedDirectories.push(path.join(process.env.WORKING_DIRECTORY,AllowedRelativeDirectories[i]));
        }
        return resolve("Finished Loading Special Directories");
    });
}