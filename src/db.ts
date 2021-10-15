import { Database, IDbDocSet, query as Q } from "@yuuza/btrdb";
import chalk from "chalk";
import { ApiError } from "./errors";
import { OneWriterLock } from "./util";

export const db = new Database();
const _lock = new OneWriterLock();

export function enterLock() {
    return _lock.enterWriter();
}

export function exitLock() {
    _lock.exitWriter();
}

export interface User {
    id: number;
    name: string;
    ojUsername: string;
    ojPassword: string;
}

export interface Sign {
    id: number;
    site: 1 | 2;
    seat: number;
    time: string;
}

export interface Seat {
    id: number;
    site: 1 | 2;
    seatNo: number;
    prio: number;
    used: boolean;
}

export let setUser: IDbDocSet<User>;
export let setSign: IDbDocSet<Sign>;
export let setSeat: IDbDocSet<Seat>;

export async function init() {
    await db.openFile("data/data.db");
    setUser = await db.createSet("user", "doc");
    setSign = await db.createSet("sign", "doc");
    await setSign.useIndexes({
        site_seat: s => [s.site, s.seat],
    })
    setSeat = await db.createSet("seat", "doc");
    await setSeat.useIndexes({
        used_site: s => [s.used, s.site],
        site_seatNo: s => [s.site, s.seatNo],
    })
}

export async function sign(id: number, site: 1 | 2) {
    let user = await setUser.get(id);
    if (!user) {
        const temp = (await setUser.query(Q`id < ${100}`)).shift();
        if (!temp) throw new ApiError('no account');
        const origId = temp.id;
        await setUser.delete(origId);
        temp.id = id;
        temp.name = '备用_' + id;
        await setUser.upsert(temp);
        user = temp;
        console.info(chalk.bold("[BACKUP_USER]"), origId, '->', id);
    }

    let sign = await setSign.get(id);

    if (!sign) {
        let usableSeats = await setSeat.query(Q`used_site == ${[false, site]}`);
        let seat: Seat | null = null;
        if (usableSeats.length > 0) {
            usableSeats = usableSeats.sort((a, b) => a.prio - b.prio);
            const prio = usableSeats[0].prio;
            usableSeats = usableSeats.filter(x => x.prio == prio);
            seat = usableSeats[Math.floor(Math.random() * usableSeats.length)];
            seat.used = true;
            await setSeat.upsert(seat);
        }

        sign = {
            id,
            seat: seat?.seatNo ?? -1,
            site,
            time: new Date().toLocaleString('sv'),
        };
        await setSign.upsert(sign);
        console.info(chalk.bold('[SIGN]'), id, `(${user.name})`, `[${site}]${seat?.seatNo}`);
    }

    await db.commit();
    return signInfo(user, sign);
}

export async function update(id: number, seat: number, name: string) {
    const user = await setUser.get(id);
    if (!user) throw new ApiError("no such user");
    const sign = await setSign.get(id);
    user.name = name;
    const [newSeat] = await setSeat.query(Q`site_seatNo == ${[sign.site, seat]}`)
    if (!newSeat) throw new ApiError("no such seat");
    newSeat.used = true;
    sign.seat = seat;
    await setUser.upsert(user);
    await setSign.upsert(sign);
    await setSeat.upsert(newSeat);
    await db.commit();
    console.info(chalk.bold("[UPDATE]"), id, `(${name})`, `[${sign.site}]${seat}`);
}

export async function getUserById(id: number) {
    let user = await setUser.get(id);
    if (!user) { throw new ApiError('no user'); }
    const sign = await setSign.get(id);
    return signInfo(user, sign);
}

export async function getUserBySeat(seat: number, site: number) {
    let [sign] = await setSign.query(Q`site_seat == ${[site, seat]}`);
    if (!sign) throw new ApiError('no record');
    const user = await setUser.get(sign.id);
    return signInfo(user, sign);
}

function signInfo(user: User, sign: Sign | null) {
    return { ...user, seat: sign?.seat, site: sign?.site, time: sign?.time }
}

export async function dump() {
    return {
        sign: await setSign.getAll(),
        user: await setUser.getAll(),
        seat: await setSeat.getAll(),
    };
}