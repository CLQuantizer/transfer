import {error, json, type RequestHandler} from '@sveltejs/kit';

export const GET: RequestHandler = async ({ params, platform }: any) => {
    try {
        if (!platform || !platform.env) {
            return json({ error: 'Platform not available' });
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
        object.writeHttpMetadata(headers);
        headers.set('etag', object.httpEtag);
        headers.set('Content-Disposition', `attachment; filename="${params.key.split('/').pop()}"`);

        // Delete the object after retrieving it
        await bucket.delete(params.key);

        // Return the response with the file data
        return new Response(body, {
            headers
        });
    } catch (err) {
        console.error('Error handling file:', err);
        throw error(500, 'Failed to process file');
    }
};