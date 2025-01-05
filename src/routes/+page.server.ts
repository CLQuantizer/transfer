import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load = (async ({ platform }) => {
    if (!platform || !platform.env) {
        throw error(500, 'Platform not available');
    }
    // Get list of objects from R2
    const bucket = platform.env.TRANSFER;
    const objects = await bucket.list();

    // Transform R2 objects into our frontend format
    const files = objects.objects.map((obj:any) => ({
        key: obj.key,
        filename: obj.key.split('/').pop() || obj.key,
        size: obj.size,
        uploadedAt: obj.uploaded,
        etag: obj.etag,
        httpEtag: obj.httpEtag
    }));

    return {
        files
    };
}) satisfies PageServerLoad;