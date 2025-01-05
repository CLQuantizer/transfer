import {error, type RequestHandler} from '@sveltejs/kit';

// Add MIME type detection
const getMimeType = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
        'mp4': 'video/mp4',
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'pdf': 'application/pdf',
        // Add more as needed
    };
    return mimeTypes[ext] || 'application/octet-stream';
};

export const GET: RequestHandler = async ({ params, platform }: any) => {
    try {
        if (!platform || !platform.env) {
            return  error(500, 'Platform not available');
        }
        const bucket = platform.env.TRANSFER;

        const object = await bucket.get(params.key);

        if (!object) {
            return error(404, 'File not found');
        }

        const body = await object.arrayBuffer();
        const headers = new Headers();

        const filename = params.key.split('/').pop() || '';

        // Set the correct MIME type for the file
        headers.set('Content-Type', getMimeType(filename));
        headers.set('Content-Disposition', `inline; filename="${filename}"`);
        headers.set('Content-Length', body.byteLength.toString());

        // Prevent caching
        headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        headers.set('Expires', '0');
        headers.set('Pragma', 'no-cache');

        await bucket.delete(params.key);

        return new Response(body, {
            headers,
            status: 200
        });
    } catch (err) {
        console.error('Error handling file:', err);
        throw error(500, 'Failed to process file');
    }
};