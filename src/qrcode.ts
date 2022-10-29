import { Context } from "koa";
import { useQrcode } from "./db";

export const qrcodePage = async (ctx: Context) => {
  const { qrcode } = ctx.params;
  ctx.response.type = "html";
  ctx.response.body = `<!DOCTYPE html>
      <html lang="zh">
      <head>
          <meta charset="UTF-8">
          <meta http-equiv="X-UA-Compatible" content="IE=edge">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>软件部机试信息</title>
          <style>
            body { font-family: sans-serif; }
            p { font-family: monospace; }
          </style>
      </head>
      <body>
      <div>
      `;
  try {
    const info = await useQrcode(qrcode);
    ctx.response.body += `
          <h1>软件部机试信息</h1>
          <p>注意: 该页面仅支持一次访问，请截图保存！</p>
          <p>学号: ${info.studentId}</p>
          <p>姓名: ${info.name}</p>
          <p>座位: ${info.seat} (考场 ${info.site})</p>
          <p>OJ 账号: <code>${info.ojUsername}</code></p>
          <p>OJ 密码: <code>${info.ojPassword}</code></p>
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
  ctx.response.body += `</div></body></html>`;
};
