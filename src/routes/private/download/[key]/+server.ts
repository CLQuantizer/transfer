import {error, type RequestHandler} from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, platform }: any) => {
    try {
        if (!platform || !platform.env) {
            return error(500, 'Platform not available');
        }
        const bucket = platform.env.TRANSFER;

        // First get the object
        const object = await bucket.get(params.key);

        if (!object) {
            return error(404, 'File not found');
        }

        // Get the object body and metadata before deletion
        const body = await object.arrayBuffer();
        const headers = new Headers();

        // Add the basic headers
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);

        // Get the original filename from the key
        const filename = params.key.split('/').pop();

        // Set content disposition and type headers for better download handling
        headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        headers.set('Content-Type', 'application/octet-stream');

        // Add headers specifically for iOS/Safari
        headers.set('Cache-Control', 'no-store');
        headers.set('Pragma', 'no-cache');

        // Delete the object after retrieving it
        await bucket.delete(params.key);

        // Return the response with the file data and enhanced headers
        return new Response(body, {
            headers,
            status: 200
        });
    } catch (err) {
        console.error('Error handling file:', err);
        throw error(500, 'Failed to process file');
    }
};