import { Database, IDbDocSet, query as Q } from "@yuuza/btrdb";
import chalk from "chalk";
import { mkdir } from "fs/promises";
import { ApiError } from "./errors";
import { sendLarkMessage } from "./externalApi";
import { generateQrcode, OneWriterLock } from "./util";

export const db = new Database();
const _lock = new OneWriterLock();

export function enterLock() {
  return _lock.enterWriter();
}

export function exitLock() {
  _lock.exitWriter();
}

export interface StudentInfo {
  name: string;
}

export interface OjUser {
  id: number;
  name: string | null;
  studentId: number | null;
  ojUsername: string;
  ojPassword: string;
}

export interface Sign {
  id: number;
  site: 1 | 2;
  seat: number;
  time: string;
  note: string;
  qrcode: string | null;
}

export interface Seat {
  id: number;
  site: 1 | 2;
  seatNo: number;
  prio: number;
  used: boolean;
}

export let setUser: IDbDocSet<OjUser>;
export let setSign: IDbDocSet<Sign>;
export let setSeat: IDbDocSet<Seat>;

export async function init() {
  await mkdir("data/", { recursive: true });
  await db.openFile("data/data.db");
  setUser = await db.createSet("user", "doc");
  await setUser.useIndexes({
    ojUsername: (s) => s.ojUsername,
    studentId: (s) => s.studentId,
  });
  setSign = await db.createSet("sign", "doc");
  await setSign.useIndexes({
    site_seat: (s) => [s.site, s.seat],
    qrcode: (s) => s.qrcode,
  });
  setSeat = await db.createSet("seat", "doc");
  await setSeat.useIndexes({
    used: (s) => s.used,
    used_site: (s) => [s.used, s.site],
    site_seatNo: (s) => [s.site, s.seatNo],
  });
}

export async function sign(id: number, site: 1 | 2, student: StudentInfo) {
  let [user] = await setUser.query(Q`studentId == ${id}`);
  if (!user) {
    user = (await setUser.query(Q`studentId == ${null}`)).shift()!;
    if (!user) throw new ApiError("no account");
    user.name = student.name;
    user.studentId = id;
    await setUser.upsert(user);
  }

  let sign = await setSign.get(id);

  if (!sign) {
    let usableSeats = await setSeat.query(Q`used_site == ${[false, site]}`);
    let seat: Seat | null = null;
    if (usableSeats.length > 0) {
      usableSeats = usableSeats.sort((a, b) => a.prio - b.prio);
      const prio = usableSeats[0].prio;
      usableSeats = usableSeats.filter((x) => x.prio == prio);
      seat = usableSeats[Math.floor(Math.random() * usableSeats.length)];
      seat.used = true;
      await setSeat.upsert(seat);
    }

    sign = {
      id,
      seat: seat?.seatNo ?? -1,
      site,
      time: new Date().toLocaleString("sv"),
      note: "",
      qrcode: await generateQrcode(),
    };
    await setSign.upsert(sign);
    console.info(
      chalk.bold("[SIGN]"),
      user.id,
      "->",
      id,
      `(${user.name})`,
      `[${site}]${seat?.seatNo}`,
    );
    sendLarkMessage(
      `【签到】学号 ${id} (${user.name}) 账号 ${user.ojUsername} 座位 ${seat?.seatNo} 考场 ${site}`,
    );
  }

  await db.commit();
  return signInfo(user, sign);
}

export async function update(
  id: number,
  seat: number,
  name: string,
  note: string | null,
) {
  let [user] = await setUser.query(Q`studentId == ${id}`);
  if (!user) throw new ApiError("no such user");
  const sign = await setSign.get(id);
  const [newSeat] = await setSeat.query(Q`site_seatNo == ${[sign.site, seat]}`);
  if (!newSeat) throw new ApiError("no such seat");
  newSeat.used = true;
  sign.seat = seat;
  if (note != null) sign.note = note;
  // await setUser.upsert(user);
  await setSign.upsert(sign);
  await setSeat.upsert(newSeat);
  await db.commit();
  console.info(
    chalk.bold("[UPDATE]"),
    id,
    `(${name})`,
    `[${sign.site}]${seat}`,
    `note=` + note,
  );
  sendLarkMessage(
    `【更新】学号 ${id} (${user.name}) 账号 ${user.ojUsername} 座位 ${newSeat?.seatNo} 考场 ${newSeat.site} 备注 "${note}"`,
  );
}

export async function useQrcode(qrcode: string) {
  const [sign] = await setSign.findIndex("qrcode", qrcode);
  if (!sign) throw new ApiError("qrcode not found");
  const [user] = await setUser.findIndex("studentId", sign.id);
  sign.qrcode = null;
  await setSign.upsert(sign);
  await db.commit();
  return signInfo(user, sign);
}

export async function newQrcode(studentId: number) {
  const sign = await setSign.get(studentId);
  sign.qrcode = await generateQrcode();
  await setSign.upsert(sign);
  await db.commit();
  return sign.qrcode;
}

export async function getUserById(id: number) {
  let [user] = await setUser.query(Q`studentId == ${id}`);
  if (!user) throw new ApiError("no user");
  const sign = await setSign.get(id);
  return signInfo(user, sign);
}

export async function getUserBySeat(seat: number, site: number) {
  let [sign] = await setSign.query(Q`site_seat == ${[site, seat]}`);
  if (!sign) throw new ApiError("no record");
  let [user] = await setUser.query(Q`studentId == ${sign.id}`);
  return signInfo(user, sign);
}

export async function getUserByOjUsername(ojUsername: string) {
  let [user] = await setUser.query(Q`ojUsername == ${ojUsername}`);
  if (!user) throw new ApiError("no user");
  const sign = user.studentId ? await setSign.get(user.studentId) : null;
  return signInfo(user, sign);
}

function signInfo(user: OjUser, sign: Sign | null) {
  return {
    ...user,
    id: user.studentId,
    seat: sign?.seat,
    site: sign?.site,
    time: sign?.time,
    note: sign?.note,
    qrcode: sign?.qrcode,
  };
}

export async function dumpSignInfo() {
  const result = [];
  for (const sign of await setSign.getAll()) {
    const [user] = await setUser.query(Q`studentId == ${sign.id}`);
    result.push(signInfo(user, sign));
  }
  return result;
}

export async function dump() {
  return {
    sign: await setSign.getAll(),
    user: await setUser.getAll(),
    seat: await setSeat.getAll(),
  };
}

export async function dumpUsed() {
  return {
    sign: await setSign.getAll(),
    user: await setUser.query(Q`studentId != ${null}`),
    seat: await setSeat.findIndex("used", true),
  };
}
