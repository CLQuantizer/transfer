/**
 * KV utility functions for file metadata and short links
 */

export interface FileMetadata {
    key: string;
    filename: string;
    size: number;
    uploadedAt: string;
    expiresAt?: string;
    downloadCount: number;
    lastAccessed?: string;
    shortKey?: string;
}

/**
 * Generate a short random key for file sharing
 */
export function generateShortKey(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

/**
 * Store file metadata in KV
 */
export async function storeFileMetadata(
    kv: KVNamespace,
    fileKey: string,
    metadata: Omit<FileMetadata, 'key' | 'downloadCount'>,
    shortKey?: string
): Promise<string> {
    const fullMetadata: FileMetadata = {
        key: fileKey,
        downloadCount: 0,
        ...metadata
    };

    // Store metadata by file key
    await kv.put(`file:${fileKey}`, JSON.stringify(fullMetadata));

    // If short key provided, create mapping
    if (shortKey) {
        await kv.put(`short:${shortKey}`, fileKey, { expirationTtl: metadata.expiresAt ? Math.floor((new Date(metadata.expiresAt).getTime() - Date.now()) / 1000) : undefined });
        fullMetadata.shortKey = shortKey;
        await kv.put(`file:${fileKey}`, JSON.stringify(fullMetadata));
    }

    return shortKey || fileKey;
}

/**
 * Get file metadata from KV
 */
export async function getFileMetadata(kv: KVNamespace, fileKey: string): Promise<FileMetadata | null> {
    const data = await kv.get(`file:${fileKey}`);
    if (!data) return null;
    return JSON.parse(data) as FileMetadata;
}

/**
 * Resolve short key to file key
 */
export async function resolveShortKey(kv: KVNamespace, shortKey: string): Promise<string | null> {
    return await kv.get(`short:${shortKey}`);
}

/**
 * Increment download count
 */
export async function incrementDownloadCount(kv: KVNamespace, fileKey: string): Promise<void> {
    const metadata = await getFileMetadata(kv, fileKey);
    if (metadata) {
        metadata.downloadCount += 1;
        metadata.lastAccessed = new Date().toISOString();
        await kv.put(`file:${fileKey}`, JSON.stringify(metadata));
    }
}

/**
 * Set file expiration
 */
export async function setFileExpiration(
    kv: KVNamespace,
    fileKey: string,
    expiresAt: string
): Promise<void> {
    const metadata = await getFileMetadata(kv, fileKey);
    if (metadata) {
        metadata.expiresAt = expiresAt;
        await kv.put(`file:${fileKey}`, JSON.stringify(metadata));
    }
}

/**
 * Check if file has expired
 */
export function isFileExpired(metadata: FileMetadata): boolean {
    if (!metadata.expiresAt) return false;
    return new Date(metadata.expiresAt) < new Date();
}

/**
 * Get all file metadata (for listing)
 * Note: KV doesn't support listing efficiently, so we'll use a different approach
 */
export async function getAllFileMetadata(kv: KVNamespace): Promise<FileMetadata[]> {
    // Note: This is a limitation - KV doesn't have efficient list operations
    // In production, you might want to maintain a separate index
    // For now, we'll rely on R2 list and enrich with KV data
    return [];
}

/**
 * Delete file metadata from KV
 */
export async function deleteFileMetadata(kv: KVNamespace, fileKey: string): Promise<void> {
    const metadata = await getFileMetadata(kv, fileKey);
    if (metadata) {
        await kv.delete(`file:${fileKey}`);
        if (metadata.shortKey) {
            await kv.delete(`short:${metadata.shortKey}`);
        }
    }
}

/**
 * Create a short shareable link
 */
export async function createShortLink(
    kv: KVNamespace,
    fileKey: string,
    expiresInHours?: number
): Promise<string> {
    const shortKey = generateShortKey();
    const metadata = await getFileMetadata(kv, fileKey);
    
    if (!metadata) {
        throw new Error('File metadata not found');
    }

    const expiresAt = expiresInHours
        ? new Date(Date.now() + expiresInHours * 60 * 60 * 1000).toISOString()
        : undefined;

    await storeFileMetadata(kv, fileKey, metadata, shortKey);
    
    if (expiresAt) {
        await setFileExpiration(kv, fileKey, expiresAt);
    }

    return shortKey;
}

