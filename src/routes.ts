//@ts-check
import Router from "@koa/router";
import { ApiError } from "./errors";
import {
  dump,
  dumpSignInfo,
  enterLock,
  exitLock,
  getUserById,
  getUserByOjUsername,
  getUserBySeat,
  newQrcode,
  sign,
  update,
  useQrcode,
} from "./db";
import { getStudentInfoById } from "./userApi";
import { qrcodePage } from "./qrcode";

export const router = new Router();

router.get("/qrcode/:qrcode", qrcodePage);

function api(func: Router.Middleware) {
  return (async (ctx, next) => {
    ctx.respond = true;
    const beforeLock = Date.now();
    await enterLock();
    let now = Date.now();
    if (now - beforeLock > 100) {
      console.info("[wait_lock_ms]", now - beforeLock);
    }
    try {
      const r = await func(ctx, next);
      ctx.respond = true;
      ctx.response.status = 200;
      if (r !== undefined) ctx.response.body = r;
    } catch (error) {
      console.error(error);
      if (error instanceof ApiError) {
        ctx.response.status = 450;
        ctx.response.body = error.message;
      }
    } finally {
      exitLock();
      now = Date.now();
      if (now - beforeLock > 100) {
        console.info("[held_lock_ms]", now - beforeLock);
      }
    }
  }) as Router.Middleware;
}

const BASE_PATH = "/api";

router.post(
  BASE_PATH + "/sign",
  api(async (ctx) => {
    const id = parseInt(ctx.request.URL.searchParams.get("id")!);
    const site = parseInt(ctx.request.URL.searchParams.get("site")!);
    if (isNaN(id)) throw new ApiError("id is not a number");
    if (site != 1 && site != 2) throw new ApiError("wrong site");
    const studentInfo = await getStudentInfoById(id);
    if (!studentInfo) throw new ApiError("student not found");
    return await sign(id, site as (1 | 2), { name: studentInfo.name });
  }),
);

router.post(
  BASE_PATH + "/new_qrcode",
  api(async (ctx) => {
    const id = parseInt(ctx.request.URL.searchParams.get("id")!);
    const qrcode = await newQrcode(id);
    return { qrcode };
  }),
);

router.post(
  BASE_PATH + "/update",
  api(async (ctx) => {
    const id = parseInt(ctx.request.URL.searchParams.get("id")!);
    const seat = parseInt(ctx.request.URL.searchParams.get("seat")!);
    const name = ctx.request.URL.searchParams.get("name")!;
    const note = ctx.request.URL.searchParams.get("note")!;
    if (isNaN(id)) throw new ApiError("id is not a number");
    if (isNaN(seat)) throw new ApiError("seat is not a number");
    return await update(id, seat, name, note);
  }),
);

router.get(
  BASE_PATH + "/query",
  api(async (ctx) => {
    const params = ctx.request.URL.searchParams;
    if (params.get("id")) {
      return await getUserById(parseInt(params.get("id")!));
    } else if (params.get("seat")) {
      const seat = parseInt(params.get("seat")!);
      const site = parseInt(params.get("site")!);
      return await getUserBySeat(seat, site);
    } else if (params.get("ojUsername")) {
      return await getUserByOjUsername(params.get("ojUsername")!);
    } else {
      throw new ApiError("usage: (id) or (seat, site) or (ojUsername)");
    }
  }),
);

router.get(
  BASE_PATH + "/signs",
  api(async (ctx) => {
    return await dumpSignInfo();
  }),
);

router.get(
  BASE_PATH + "/dump",
  api(async (ctx) => {
    return await dump();
  }),
);
