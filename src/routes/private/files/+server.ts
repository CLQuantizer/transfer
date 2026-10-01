import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listFiles } from '$lib/list-files';

export const GET: RequestHandler = async ({ platform }) => {
	try {
		if (!platform?.env?.TRANSFER) {
			return error(500, 'Platform not available');
		}

		const files = await listFiles(platform.env.TRANSFER, platform.env.TRANSFER_KV);
		return json({ files });
	} catch (err) {
		console.error('List files error:', err);
		throw error(500, 'Failed to list files');
	}
};
