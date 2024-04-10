import {GetFullPathFromRelativePath} from "../InputValidator.js";
import * as path from "path";

/*Array of special Directory Paths that traversal validation will not be applied to*/
export const SpecialDirectories = [];

/*Array of special Relative Directory Paths that traversal validation will not be applied to */
const SpecialRelativeDirectories = [
    "DirectoryNavigator"
]

/*Loads the Special Directories Array*/
export async function LoadSpecialDirectories(){
    return new Promise((resolve) => {
        for (const i in SpecialRelativeDirectories) {
            SpecialDirectories.push(path.join(process.env.WORKING_DIRECTORY,SpecialRelativeDirectories[i]));
        }
        return resolve("Finished Loading Special Directories");
    });
}