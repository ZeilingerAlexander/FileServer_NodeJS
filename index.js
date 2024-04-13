// Entry Point, configure stuff pre-server-start here
import { config } from "dotenv";
import * as http from "http";
import {StartServer} from "./server.js";
import {LoadSpecialDirectories, AllowedDirectories} from "./variables/AllowedDirectories.js";
import * as path from "path";
import {LogDebugMessage} from "./logger.js";

// set env path
config ({path: "./.env"});

// configure some important paths
process.env.WORKING_DIRECTORY = process.cwd();
process.env.STATIC_PATH = path.join(process.env.WORKING_DIRECTORY, "/static");

// Load Special Directories excluded from path traversal detection
await LoadSpecialDirectories();

// start the server
const serverMessage = await StartServer();
await LogDebugMessage(serverMessage)
