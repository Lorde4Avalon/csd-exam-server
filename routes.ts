//@ts-check
import Router from "@koa/router";
import { ApiError } from "./errors";
import { getUser, sign } from "./db";
export const router = new Router();

function api(func: Router.Middleware) {
    return (async (ctx, next) => {
        ctx.respond = true;
        try {
            const r = await func(ctx, next);
            ctx.respond = true;
            ctx.response.status = 200;
            ctx.response.body = r;
        } catch (error) {
            console.error(error);
            if (error instanceof ApiError) {
                ctx.response.status = 450;
                ctx.response.body = error.message;
            }
        }
    }) as Router.Middleware
}

router.post('/sign', api(async (ctx) => {
    const id = parseInt(ctx.request.URL.searchParams.get('id')!);
    const site = parseInt(ctx.request.URL.searchParams.get('site')!);
    if (isNaN(id)) throw new ApiError('id is not a number');
    if (site != 1 && site != 2) throw new ApiError('wrong site');
    return await sign(id, site);
}));

router.post('/update', api(async (ctx) => {
    const id = parseInt(ctx.request.URL.searchParams.get('id')!);
    const seat = parseInt(ctx.request.URL.searchParams.get('seat')!);
    const name = ctx.request.URL.searchParams.get('name')!;
    if (isNaN(id)) throw new ApiError('id is not a number');
    if (isNaN(seat)) throw new ApiError('seat is not a number');
    return await update(id, seat, name);
}));

router.get('/query', api(async (ctx) => {
    const id = parseInt(ctx.request.URL.searchParams.get('id')!);
    if (isNaN(id)) throw new ApiError('id is not a number');
    return await getUser(id);
}));
