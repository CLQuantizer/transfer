import {error, type RequestHandler} from '@sveltejs/kit';
import { getMimeType, extractFilename } from '$lib/file-utils';
import { resolveShortKey, getFileMetadata, incrementDownloadCount, isFileExpired } from '$lib/kv-utils';

export const GET: RequestHandler = async ({ params, platform }: any) => {
    try {
        if (!platform || !platform.env) {
            return error(500, 'Platform not available');
        }
        const bucket = platform.env.TRANSFER;
        const kv = platform.env.TRANSFER_KV;

        let fileKey = params.key;

        // Check if this is a short key
        if (kv && fileKey.length === 8 && /^[a-zA-Z0-9]+$/.test(fileKey)) {
            const resolvedKey = await resolveShortKey(kv, fileKey);
            if (resolvedKey) {
                fileKey = resolvedKey;
            }
        }

        // Get file metadata from KV if available
        let metadata = null;
        if (kv) {
            metadata = await getFileMetadata(kv, fileKey);
            
            // Check if file has expired
            if (metadata && isFileExpired(metadata)) {
                return error(410, 'File has expired');
            }

            // Increment download count
            if (metadata) {
                await incrementDownloadCount(kv, fileKey);
            }
        }

        const object = await bucket.get(fileKey);

        if (!object) {
            return error(404, 'File not found');
        }

        const body = await object.arrayBuffer();
        const headers = new Headers();

        const filename = metadata?.filename || extractFilename(fileKey);

        // Set the correct MIME type for the file
        headers.set('Content-Type', getMimeType(filename));
        headers.set('Content-Disposition', `inline; filename="${filename}"`);
        headers.set('Content-Length', body.byteLength.toString());

        // Prevent caching
        headers.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        headers.set('Expires', '0');
        headers.set('Pragma', 'no-cache');

        // Delete file after download (one-time use)
        await bucket.delete(fileKey);
        
        // Delete metadata from KV
        if (kv && metadata) {
            await kv.delete(`file:${fileKey}`);
            if (metadata.shortKey) {
                await kv.delete(`short:${metadata.shortKey}`);
            }
        }

        return new Response(body, {
            headers,
            status: 200
        });
    } catch (err) {
        console.error('Error handling file:', err);
        throw error(500, 'Failed to process file');
    }
};