import { handleCommand } from "./src/commands";
import { init } from "./src/db";

async function main() {
    const argv = process.argv.slice(2);
    await init();
    await handleCommand(argv)
}

main();
