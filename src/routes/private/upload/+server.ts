import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateFileKey, getMimeType, validateFile } from '$lib/file-utils';
import { storeFileMetadata, generateShortKey } from '$lib/kv-utils';

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        if (!platform?.env?.TRANSFER) {
            return json({ error: 'Platform not available' });
        }

        const bucket = platform.env.TRANSFER;
        const kv = platform.env.TRANSFER_KV;
        const formData = await request.formData();
        const file = formData.get('file');
        const expiresInHours = formData.get('expiresInHours') 
            ? parseInt(formData.get('expiresInHours') as string) 
            : undefined;

        if (!file || !(file instanceof File)) {
            return error(400, 'No file uploaded');
        }

        // Validate file (100MB limit)
        const maxSize = 100 * 1024 * 1024;
        const validation = validateFile(file, maxSize);
        if (!validation.valid) {
            return error(400, validation.error || 'Invalid file');
        }

        // Generate a unique key for the file
        const key = generateFileKey(file.name);

        // Upload to R2
        const arrayBuffer = await file.arrayBuffer();
        const contentType = file.type || getMimeType(file.name);
        const uploaded = await bucket.put(key, arrayBuffer, {
            httpMetadata: {
                contentType
            }
        });

        const uploadedAt = new Date().toISOString();
        const expiresAt = expiresInHours
            ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
            : undefined;

        // Generate short key for shareable link
        const shortKey = generateShortKey();

        // Store metadata in KV
        if (kv) {
            await storeFileMetadata(kv, key, {
                filename: file.name,
                size: file.size,
                uploadedAt,
                expiresAt
            }, shortKey);
        }

        // Return the file details that match your R2File interface
        return json({
            key,
            filename: file.name,
            size: file.size,
            uploadedAt,
            etag: uploaded.etag,
            httpEtag: uploaded.httpEtag,
            shortKey: kv ? shortKey : undefined,
            expiresAt
        });

    } catch (err) {
        console.error('Upload error:', err);
        throw error(500, 'Failed to upload file');
    }
};

// Optional: Add configuration for handling larger files
export const config = {
    api: {
        bodyParser: {
            sizeLimit: '10mb' // Adjust this limit as needed
        }
    }
};