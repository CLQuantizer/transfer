import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveShortKey, getFileMetadata, isFileExpired } from '$lib/kv-utils';

/**
 * Get file info by short key (without downloading)
 */
export const GET: RequestHandler = async ({ params, platform }) => {
    try {
        if (!platform?.env?.TRANSFER_KV) {
            return error(500, 'KV not available');
        }

        const kv = platform.env.TRANSFER_KV;
        const shortKey = params.key;

        // Resolve short key to file key
        const fileKey = await resolveShortKey(kv, shortKey);
        if (!fileKey) {
            return error(404, 'Short link not found');
        }

        // Get file metadata
        const metadata = await getFileMetadata(kv, fileKey);
        if (!metadata) {
            return error(404, 'File metadata not found');
        }

        // Check if expired
        if (isFileExpired(metadata)) {
            return error(410, 'File has expired');
        }

        return json({
            key: fileKey,
            shortKey,
            filename: metadata.filename,
            size: metadata.size,
            uploadedAt: metadata.uploadedAt,
            expiresAt: metadata.expiresAt,
            downloadCount: metadata.downloadCount,
            downloadUrl: `/private/download/${shortKey}`
        });
    } catch (err) {
        console.error('Error getting short link info:', err);
        throw error(500, 'Failed to get file info');
    }
};

