import {error, json} from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
    try {
        if (!platform || !platform.env) {
            return json({ error: 'Platform not available' });
        }
        const bucket = platform.env.TRANSFER;
        const object = await bucket.get(params.key);

        if (!object) {
            return error(404, 'File not found');
        }

        // Get the headers from R2 object
        const headers = new Headers();
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        // Set content disposition to trigger download
        headers.set('Content-Disposition', `attachment; filename="${params.key.split('/').pop()}"`);

        return new Response(object.body, {
            headers
        });
    } catch (err) {
        console.error('Error downloading file:', err);
        throw error(500, 'Failed to download file');
    }
};