//@ts-check
import { Database } from "@yuuza/btrdb";
import Koa from "koa";
import { init } from "./db";
import { router } from "./routes";

const app = new Koa();

app.use(async (ctx, next) => {
    const begin = Date.now();
    await next();
    const req = ctx.request;
    console.info(`[${new Date().toISOString()}] ${req.ip} | ${ctx.response.status} | ${req.method} ${req.url.toString()} | (${Date.now() - begin} ms)`);
});

app.use(router.routes());

async function main() {
    await init();
    console.info('Listening...');
    app.listen(5022);
}

main();
