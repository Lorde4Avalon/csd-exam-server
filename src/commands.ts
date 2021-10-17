import { db, init, setSeat, setSign, setUser, dump, dumpSignInfo } from "./db";
import { readFile, writeFile } from "fs/promises";

// standard 'readline' boilerplate
import readline from 'readline';
const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

export function input(prompt: string = ''): Promise<string> {
    return new Promise((resolve) => {
        readlineInterface.question(prompt, (input) => resolve(input));
    });
}

export async function writeData(str: string, path?: string | null) {
    if (path) {
        await writeFile(path, str, 'utf-8');
        console.info('written to file', path);
    } else {
        console.info(str);
    }
}

export async function handleCommand(argv: string[]) {
    const cmd = argv[0];
    if (Object.prototype.hasOwnProperty.call(commands, cmd)) {
        await commands[cmd](argv);
    } else {
        console.info('commands:')
        console.info('  dump [file.json]')
        console.info('  dump_signs [file.csv]')
        console.info('  import_users <file>')
        console.info('  gen_seats')
    }
}

const commands: Record<string, (argv: string[]) => Promise<void>> = {
    async dump(argv) {
        const str = JSON.stringify(await dump());
        await writeData(str, argv[1]);
    },

    async dump_signs(argv) {
        const signs = await dumpSignInfo();
        const str = signs
            .sort((a, b) => a.ojUsername.localeCompare(b.ojUsername))
            .map(x => `${x.id},${x.name},${x.ojUsername},${x.site},${x.seat},${x.time}\n`).join('');
        await writeData(str, argv[1]);
    },

    async import_users(argv) {
        console.info('Had', setUser.count, 'users.');
        if (setUser.count > 0) {
            if ((await input('Users exists? overwrite? (yes/NO)')).toLowerCase() != 'yes') {
                return;
            }
        }
        for (const x of await setUser.getIds()) {
            await setUser.delete(x);
        }
        for (let line of (await readFile(argv[1], 'utf-8')).split('\n')) {
            if (!line) continue;
            line = line.trim();
            const [id, name, ojUsername, ojPassword] = line.split(',');
            await setUser.upsert({ id: parseInt(id), name, ojUsername, ojPassword });
        }
        console.info('Have', setUser.count, 'users now.');
        await db.commit();
    },

    async gen_seats(argv) {
        if (setSeat.count > 0) {
            if ((await input('Seats exists? overwrite? (yes/NO)')).toLowerCase() != 'yes') {
                return;
            }
        }
        for (const x of await setSeat.getIds()) {
            await setSeat.delete(x);
        }
        const STEP_SIZE = 5;
        const steps = [
            10, 8, 7, 4, 3, 0,
            11, 9, 6, 5, 2, 1,
        ];
        const prios = [
            8, 5, 5, 3, 3, 7,
            8, 6, 6, 4, 4, 7,
        ];
        const prioMap = Object.fromEntries(steps.map((x, i) => [x, prios[i]]));
        for (const site of [1, 2] as const) {
            for (let i = 0; i < 60; i++) {
                await setSeat.insert({
                    site,
                    seatNo: i + 1,
                    prio: prioMap[Math.floor(i / STEP_SIZE)],
                    used: false,
                })
            }
        }
        console.info('Generated.');
        await db.commit();
    },
}
