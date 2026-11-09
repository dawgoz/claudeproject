import 'dotenv/config';
import { runCli } from './cli.js';
import { ReviewError } from './utils/error-handler.js';
try {
    const files = await runCli(process.argv.slice(2));
    for (const file of files)
        console.log(`Report written: ${file}`);
}
catch (error) {
    if (error instanceof ReviewError) {
        console.error(`[${error.code}] ${error.message}`);
    }
    else {
        console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
}
