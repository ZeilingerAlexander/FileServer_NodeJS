export async function LogDebugMessage(msg){
    if (process.env.LOGDEBUGMESSAGES == "true"){
        console.log(msg);
    }
}
export async function LogErrorMessage(msg, err){
    if (process.env.LOGERRORMESSAGES == "true"){
        console.log(msg, err);
    }
}