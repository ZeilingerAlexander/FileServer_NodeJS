// Entry Point, configure stuff pre-server-start here
import { config } from "dotenv";
import * as http from "http";
import {StartServer} from "./server.js";

// set env path
config ({path: "./.env"});

// set file directory path (static path)
// TODO : Automaticly build it so its able to run under windows and linux (not hard coded)
console.log(process.env.STATIC_PATH);

// start the server
const serverMessage = await StartServer();
console.log(serverMessage);
