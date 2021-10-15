import { db, init, setSeat, setSign, setUser } from "./db";
import { readFile } from "fs/promises";

async function main() {
    const argv = process.argv.slice(2);
    const cmd = argv[0];
    if (cmd == 'dump') {
        await init();
        console.info(JSON.stringify({
            sign: await setSign.getAll(),
            user: await setUser.getAll(),
            seat: await setSeat.getAll(),
        }));
    } else if (cmd == 'import_user') {
        await init();
        for (const x of await setUser.getIds()) {
            await setUser.delete(x);
        }
        for (let line of (await readFile(argv[1], 'utf-8')).split('\n')) {
            if (!line) continue;
            line = line.trim();
            const [id, name, ojUsername, ojPassword] = line.split(',');
            await setUser.upsert({ id: parseInt(id), name, ojUsername, ojPassword });
        }
        await db.commit();
    } else if (cmd == 'gen_seats') {
        await init();
        for (const x of await setSeat.getIds()) {
            await setSeat.delete(x);
        }
        for (const site of [1, 2] as const) {
            for (let i = 0; i < 60; i++) {
                await setSeat.insert({
                    site,
                    seatNo: i + 1,
                    prio: Math.floor(i / 10),
                    used: false,
                })
            }
        }
        await db.commit();
    } else {
        console.info('commands:')
        console.info('  dump')
        console.info('  import_user <file>')
        console.info('  gen_seats')
    }
}

main();