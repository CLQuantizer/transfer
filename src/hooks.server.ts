import {strEqIgnCase} from "$lib/client/common";

/** @type {import('@sveltejs/kit').HandleServerError} */
export function handleError(input: any) {
    const message = input.error.message;
    return { message };
}


const publicPaths = ['/public', '/docs', '/stripe', '/auth', '/cron', '/ja',
    '/how-it-works', '/pricing',
    '/blog', '/learn', '/features','/books','/about'];

export const handle =  async ({ event, resolve }) => {
    const isPublicRoute = publicPaths.some(path => event.url.pathname.startsWith(path)
        || (strEqIgnCase(event.url.pathname.toLowerCase(),'/')));
    if (isPublicRoute) {
        return await resolve(event);
    }

    // const parse = tokenSchema.safeParse(event.cookies.get(FE_TOKEN));
    // if (!parse.success) {
    //     console.error("Token json Parsed error:", parse.error);
    //     return new Response('Redirect', {status: 303, headers: {Location: '/auth/login'}});
    // }
    // const token = parse.data.access_token;
    // try {
    //     const {sub, email} = jwt.verify(token, JWT_SECRET) as {sub:string, email:string};
    //     event.locals.user = await getUser(sub, email);
    // } catch (e) {
    //     return new Response('Redirect', {status: 303, headers: {Location: '/auth/login'}});
    // }
    return await resolve(event)
}