import { extractFilename } from '$lib/file-utils';
import { getFileMetadata, type FileMetadata } from '$lib/kv-utils';

export interface ListedFile {
	key: string;
	filename: string;
	size: number;
	uploadedAt: string;
	etag?: string;
	httpEtag?: string;
	shortKey?: string;
	expiresAt?: string;
	downloadCount: number;
}

/**
 * List files from R2, enriched with KV metadata (newest first).
 */
export async function listFiles(bucket: any, kv?: KVNamespace): Promise<ListedFile[]> {
	const objects = await bucket.list();

	const files = await Promise.all(
		objects.objects.map(async (obj: any) => {
			const key = obj.key;
			let metadata: FileMetadata | null = null;

			if (kv) {
				metadata = await getFileMetadata(kv, key);
			}

			const uploadedAt =
				metadata?.uploadedAt ||
				(obj.uploaded instanceof Date ? obj.uploaded.toISOString() : String(obj.uploaded));

			return {
				key,
				filename: metadata?.filename || extractFilename(key),
				size: metadata?.size || obj.size,
				uploadedAt,
				etag: obj.etag,
				httpEtag: obj.httpEtag,
				shortKey: metadata?.shortKey,
				expiresAt: metadata?.expiresAt,
				downloadCount: metadata?.downloadCount || 0
			} satisfies ListedFile;
		})
	);

	files.sort((a, b) => {
		const dateA = new Date(a.uploadedAt).getTime();
		const dateB = new Date(b.uploadedAt).getTime();
		return dateB - dateA;
	});

	return files;
}
