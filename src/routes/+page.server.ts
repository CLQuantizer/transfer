import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { extractFilename } from '$lib/file-utils';
import { getFileMetadata, type FileMetadata } from '$lib/kv-utils';

export const load = (async ({ platform }) => {
    // Get list of objects from R2
    if (!platform || !platform.env) {
        throw error(500, 'Platform not available');
    }
    const bucket = platform.env.TRANSFER;
    const kv = platform.env.TRANSFER_KV;
    const objects = await bucket.list();

    // Transform R2 objects into our frontend format, enriched with KV metadata
    const files = await Promise.all(
        objects.objects.map(async (obj: any) => {
            const key = obj.key;
            let metadata: FileMetadata | null = null;

            // Try to get metadata from KV
            if (kv) {
                metadata = await getFileMetadata(kv, key);
            }

            return {
                key,
                filename: metadata?.filename || extractFilename(key),
                size: metadata?.size || obj.size,
                uploadedAt: metadata?.uploadedAt || obj.uploaded,
                etag: obj.etag,
                httpEtag: obj.httpEtag,
                shortKey: metadata?.shortKey,
                expiresAt: metadata?.expiresAt,
                downloadCount: metadata?.downloadCount || 0
            };
        })
    );

    // Sort by upload date (newest first)
    files.sort((a, b) => {
        const dateA = new Date(a.uploadedAt).getTime();
        const dateB = new Date(b.uploadedAt).getTime();
        return dateB - dateA;
    });

    return {
        files
    };
}) satisfies PageServerLoad;