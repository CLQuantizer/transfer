import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
    try {
        if (!platform?.env?.TRANSFER) {
            return json({ error: 'Platform not available' });
        }

        const bucket = platform.env.TRANSFER;
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return error(400, 'No file uploaded');
        }

        // Generate a unique key for the file
        const timestamp = new Date().getTime();
        const key = `${timestamp}-${file.name}`;

        // Upload to R2
        const arrayBuffer = await file.arrayBuffer();
        const uploaded = await bucket.put(key, arrayBuffer, {
            httpMetadata: {
                contentType: file.type
            }
        });

        // Return the file details that match your R2File interface
        return json({
            key,
            filename: file.name,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            etag: uploaded.etag,
            httpEtag: uploaded.httpEtag
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