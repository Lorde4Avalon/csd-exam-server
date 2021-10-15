import { Database, IDbDocSet, query as Q } from "@yuuza/btrdb";
import { ApiError } from "./errors";

export const db = new Database();

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
    await db.openFile("data.db");
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
        await setUser.delete(temp.id);
        temp.id = id;
        temp.name = '备用_' + id;
        await setUser.upsert(temp);
        user = temp;
    }

    let sign = await setSign.get(id);

    if (!sign) {
        let usableSeats = await setSeat.query(Q`used_site == ${[false, site]}`);
        let seat: Seat | null = null;
        if (usableSeats.length > 0) {
            usableSeats = usableSeats.sort((a, b) => a.prio - b.prio);
            const prio = usableSeats[0].prio;
            usableSeats = usableSeats.filter(x => x.prio == prio);
            console.info(usableSeats);
            seat = usableSeats[Math.floor(Math.random() * usableSeats.length)];
            seat.used = true;
            await setSeat.upsert(seat);
        }

        sign = {
            id,
            seat: seat?.seatNo ?? -1,
            site
        };
        await setSign.upsert(sign);
    }

    await db.commit();
    return { ...user, seat: sign?.seat, site: sign?.site };
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
}

export async function getUserById(id: number) {
    let user = await setUser.get(id);
    if (!user) {
        user = { id, name: '', ojUsername: '', ojPassword: '' };
    }
    const sign = await setSign.get(id);
    return { ...user, seat: sign?.seat, site: sign?.site };
}

export async function getUserBySeat(seat: number, site: number) {
    let [sign] = await setSign.query(Q`site_seat == ${[site, seat]}`);
    if (!sign) throw new ApiError('no record');
    const user = await setUser.get(sign.id);
    return { ...user, seat: sign.seat, site: sign.site };
}
