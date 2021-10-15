import Koa from "koa";
import cors from "@koa/cors"
import compress from "koa-compress";
import { init } from "./src/db";
import { router } from "./src/routes";
import { handleCommand, input } from "./src/commands";
import { config } from "./config";

// trick for dynamic importing in ts-node
const importTask = (0, eval)("import('node-fetch')") as Promise<typeof import('node-fetch')>;

const app = new Koa();

app.use(compress());

app.use(cors());

// Console request logging
app.use(async (ctx, next) => {
    const begin = Date.now();
    await next();
    const req = ctx.request;
    console.info(`[REQ] ${new Date().toLocaleString('sv')} | ${ctx.response.status} | ${req.method} ${req.url.toString()} | ${req.ip} | (${Date.now() - begin} ms)`);
});

// HTTP Basic auth
const authValue = 'Basic ' + Buffer.from(config.username + ':' + config.password, 'utf-8').toString('base64');
app.use(async (ctx, next) => {
    if (ctx.request.get('Authorization') != authValue) {
        ctx.response.set('WWW-Authenticate', 'Basic realm="Login"');
        ctx.response.status = 401;
        ctx.respond = true;
        return;
    }
    await next();
});

// reverse-proxy frontend
app.use(async (ctx, next) => {
    if (!ctx.request.url.startsWith('/api/') && ['GET', 'OPTION'].includes(ctx.request.method)) {
        const { default: fetch } = await importTask;
        const resp = await fetch('https://csd-exam-tool.vercel.app' + ctx.request.url, {
            method: ctx.request.method
        });
        ctx.response.body = resp.body;
        ctx.response.status = resp.status;
        ctx.response.set('Content-Type', resp.headers.get('Content-Type') ?? '');
        ctx.respond = true;
        return;
    }
    await next();
})

app.use(router.routes());

async function main() {
    await init();
    console.info('Listening...');
    app.listen(5022);

    // REPL
    await handleCommand(['help']);
    while (true) {
        const line = await input('> ');
        if (line) {
            await handleCommand(line.split(' '));
        }
    }
}

main();
