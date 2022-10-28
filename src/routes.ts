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
import fetch from "node-fetch";
import { config } from "../config";

export const router = new Router();

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
    const resp = await fetch(
      `http://106.15.2.32:1337/api/forms?filters[studentId][$eq]=${id}`,
      {
        headers: {
          Authorization: "Bearer " + config.userApiToken,
        },
      },
    );
    const { data } = await resp.json();
    if (data.length === 0) throw new ApiError("student id not found");
    const { attributes } = data[data.length - 1];
    return await sign(id, site as (1 | 2), {
      studentId: attributes.studentId,
      name: attributes.name,
    });
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

// NOTE: not admin API
router.get("/qrcode/:qrcode", async (ctx) => {
  const { qrcode } = ctx.params;
  ctx.response.type = "html";
  ctx.response.body = `
  <style> body { font-family: sans-serif; } </style>
  <div>
  `;
  try {
    const info = await useQrcode(qrcode);
    ctx.response.body += `
      <h1>软件部机试信息</h1>
      <p>注意: 该页面仅支持一次访问，请截图保存！</p>
      <p>学号: ${info.studentId}</p>
      <p>姓名: ${info.name}</p>
      <p>座位: ${info.seat} (考场: ${info.site})</p>
      <p>OJ 账号: ${info.ojUsername}</p>
      <p>OJ 密码: ${info.ojPassword}</p>
      <p>OJ 地址: https://csd.moe/oj</p>
    `;
  } catch (error: any) {
    if (error?.message !== "qrcode not found") {
      console.error(error);
      ctx.response.body = `<p>发生错误，请联系工作人员。</p>`;
    } else {
      ctx.response.body = `<p>地址无效，请联系工作人员。</p>`;
    }
  }
  ctx.response.body += `</div>`;
});

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
