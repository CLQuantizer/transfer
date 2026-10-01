import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { listFiles } from '$lib/list-files';

export const load = (async ({ platform }) => {
	if (!platform || !platform.env) {
		throw error(500, 'Platform not available');
	}

	const files = await listFiles(platform.env.TRANSFER, platform.env.TRANSFER_KV);

	return {
		files
	};
}) satisfies PageServerLoad;
