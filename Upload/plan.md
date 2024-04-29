# plan for uploading files

# frontend

## get file from user selection via drag and drop or upload button
## if single file upload directly, if multiple make user confirm
## upload file to backend
## if request returns a certain result indicating that overwrite is necessary ask user if it should overwrite if yes set the header and resend
## check the result of the request and reload the directory nav if necessary
### https://developer.mozilla.org/en-US/docs/Web/API/File_API/Using_files_from_web_applications

# backend

## recieve file or multiple files from upload (2 seperate handlers or 1 depending on implementation)
## check if file exists, if so check if request contains a certain header indicating an overwrite action, if not return a certain error code or result indicating that the request needs overwrite flag
### if file exists and overwrite flag is set remove old file
## check if the temp entries already contains that file, if so remove any leftovers and remove it from tempfiles
## add it to tempfiles (the files being handled)
## start the file creation process, on failure try removing leftovers and abort
### when completed remove from tempfiles and return success message so frontend knows when to reload