import {LogErrorMessage} from "../logger.js";
import {HandleSimpleResultMessage} from "../server.js";

let WeakRequestQueue = {
    lastRequestTimestamp : 0,
    queue : [
        // ip
    ]
}
let MediumRequestQueue = {
    lastRequestTimestamp : 0,
    queue : [
        // ip
    ]
}
let StrongRequestQueue = {
    lastRequestTimestamp : 0,
    queue : [
        // ip
    ]
}

/*appplies rate limiting to the provided request with the provided values*/
async function ApplyAmbigousRequestRateLimit (req, request_queue, Reset_Timeout, MaxAllowedRequestsPerTimout){
    return new Promise (async (resolve, reject) => {
        // get request ip
        const ip = req.socket.remoteAddress;
        const currentTime = Date.now();
        
        // check if still in current queue bracket
        if (currentTime - request_queue.lastRequestTimestamp  < Reset_Timeout){
            // check if current bracket still allowes more requests of the current ip address
            if (request_queue.queue.filter((p) => 
                (p === ip)).length < MaxAllowedRequestsPerTimout){
                // allows for more so add it and resolve
                request_queue.queue.push(ip);
                return resolve("Accepted Request");
            }
            else{
                // doesnt allow for more so reject
                return reject("Limit Reached for ip");
            }
        }
        else{
            // create new bracket
            request_queue.lastRequestTimestamp = currentTime;
            request_queue.queue = [];
            request_queue.queue.push(ip);
            return resolve("Accepted Request");
        }
    });
}

/*Applies the weak request rate limit to provided request*/
async function ApplyWeakRequestRateLimit(req){
    return new Promise (async (resolve,reject) => {
        const resultmsg = await ApplyAmbigousRequestRateLimit(
            req, WeakRequestQueue, process.env.RATELIMIT_WEAKRESETTIMEOUT, process.env.RATELIMIT_WEAKMAXALLOWEDREQUESTSPERTIMOUT).catch(
            (err) => LogErrorMessage(err.message)
        );
        if (!resultmsg){
            return reject("Rate Limit Reached");
        }
        return resolve("No Rate Limit applied");
    });
}

/*Applies the medium request rate limit to provided request*/
async function ApplyMediumRequestRateLimit(req){
    return new Promise (async (resolve,reject) => {
        const resultmsg = await ApplyAmbigousRequestRateLimit(
            req, MediumRequestQueue, process.env.RATELIMIT_MEDIUMRESETTIMEOUT, process.env.RATELIMIT_MEDIUMMAXALLOWEDREQUESTSPERTIMOUT).catch(
            (err) => LogErrorMessage(err.message));
        if (!resultmsg){
            return reject("Rate Limit Reached");
        }
        return resolve("No Rate Limit applied");
    });
}

/*Applies the strong request rate limit to provided request*/
async function ApplyStrongRequestRateLimit(req){
    return new Promise (async (resolve,reject) => {
        const resultmsg = await ApplyAmbigousRequestRateLimit(
            req, StrongRequestQueue, process.env.RATELIMIT_STRONGRESETTIMEOUT, process.env.RATELIMIT_STRONGMAXALLOWEDREQUESTSPERTIMOUT).catch(
            (err) => LogErrorMessage(err.message));
        if (!resultmsg){
            return reject("Rate Limit Reached");
        }
        return resolve("No Rate Limit applied");
    });
}

/*Handles rate limiting on the provided req and res with the level of strength (0,1,2) (weak,medium,strong)
* returns a simple rate limit error to result and ends result if rate limiting applies
* resolves with true if rate limit got reached and false if not*/
export async function HandleRateLimit(req, res, strength){
    return new Promise (async (resolve) => {
        let result_message = undefined;
        switch (strength){
            case 0 : result_message = await ApplyWeakRequestRateLimit(req).catch((err) => {}); break;
            case 1 : result_message = await ApplyMediumRequestRateLimit(req).catch((err) => {}); break;
            case 2 : result_message = await ApplyStrongRequestRateLimit(req).catch((err) => {}); break;
            default : throw "bad input for strength";
        }
        if (!result_message){
            // rate limiting failed, so apply it by rejecting and setting result error
            await HandleSimpleResultMessage(res,  429, "Rate Limit Reached");
            res.end();
            return resolve(true);
        }
        // rate limiting succeded (meaning it shouldnt get applied)
        return resolve(false);
    });
}