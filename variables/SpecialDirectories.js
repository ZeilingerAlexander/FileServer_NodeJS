import {GetFullPathFromRelativePath} from "../InputValidator.js";

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
            SpecialDirectories.push(GetFullPathFromRelativePath(SpecialRelativeDirectories[i]));
        }
        return resolve("Finished Loading Special Directories");
    });
}