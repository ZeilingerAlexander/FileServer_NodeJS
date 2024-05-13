// Entry Point, configure stuff pre-server-start here
import { config } from "dotenv";
import * as http from "http";
import {StartServer} from "./server.js";
import {LoadSpecialDirectories, AllowedDirectories} from "./variables/AllowedDirectories.js";
import * as path from "path";
import {LogDebugMessage} from "./logger.js";
import {GenerateSensitiveInformation} from "./GenerateSensitiveInformation.js";
import {CreateDbContext} from "./Database/db.js";
import {GetPasswordHash} from "./InputValidator.js";

// set env path
config ({path: "./.env"});

// configure some important paths
process.env.WORKING_DIRECTORY = process.cwd();
process.env.STATIC_PATH = path.join(process.env.WORKING_DIRECTORY, "/static");

// Load Special Directories excluded from path traversal detection
await LoadSpecialDirectories();

// Generate Sensitive Information
process.env = GenerateSensitiveInformation(process.env);

// connect to mysql server, if it fails it rejects and program exists :)
await CreateDbContext(process.env);

// TODO : add creating the important directories if they dont exist (static, users, users-zips, PublicResources, etc...)

// start the server
const serverMessage = await StartServer();
await LogDebugMessage(serverMessage)