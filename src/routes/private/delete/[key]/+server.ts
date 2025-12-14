import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ params, platform }) => {
    try {
        if (!platform?.env?.TRANSFER) {
            return error(500, 'Platform not available');
        }

        const bucket = platform.env.TRANSFER;
        const key = params.key;

        // Check if file exists
        const object = await bucket.head(key);
        if (!object) {
            return error(404, 'File not found');
        }

        // Delete the file
        await bucket.delete(key);

        return json({ success: true, message: 'File deleted successfully' });
    } catch (err) {
        console.error('Delete error:', err);
        throw error(500, 'Failed to delete file');
    }
};

