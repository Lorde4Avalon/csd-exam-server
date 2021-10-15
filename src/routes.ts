//@ts-check
import Router from "@koa/router";
import { ApiError } from "./errors";
import { enterLock, exitLock, getUserById, getUserBySeat, sign, update } from "./db";
export const router = new Router();

function api(func: Router.Middleware) {
    return (async (ctx, next) => {
        ctx.respond = true;
        const beforeLock = Date.now();
        await enterLock();
        let now = Date.now();
        if (now - beforeLock > 100) console.info("[wait_lock_ms]", now - beforeLock);
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
            if (now - beforeLock > 100) console.info("[held_lock_ms]", now - beforeLock);
        }
    }) as Router.Middleware
}

const BASE_PATH = '/api';

router.post(BASE_PATH + '/sign', api(async (ctx) => {
    const id = parseInt(ctx.request.URL.searchParams.get('id')!);
    const site = parseInt(ctx.request.URL.searchParams.get('site')!);
    if (isNaN(id)) throw new ApiError('id is not a number');
    if (site != 1 && site != 2) throw new ApiError('wrong site');
    return await sign(id, site);
}));

router.post(BASE_PATH + '/update', api(async (ctx) => {
    const id = parseInt(ctx.request.URL.searchParams.get('id')!);
    const seat = parseInt(ctx.request.URL.searchParams.get('seat')!);
    const name = ctx.request.URL.searchParams.get('name')!;
    if (isNaN(id)) throw new ApiError('id is not a number');
    if (isNaN(seat)) throw new ApiError('seat is not a number');
    return await update(id, seat, name);
}));

router.get(BASE_PATH + '/query', api(async (ctx) => {
    const id = parseInt(ctx.request.URL.searchParams.get('id')!);
    if (!isNaN(id)) {
        return await getUserById(id);
    } else {
        const seat = parseInt(ctx.request.URL.searchParams.get('seat')!);
        const site = parseInt(ctx.request.URL.searchParams.get('site')!);
        if (!isNaN(seat) && !isNaN(site)) {
            return await getUserBySeat(seat, site);
        } else {
            throw new ApiError('usage: (id) or (seat, site)');
        }
    }
}));
