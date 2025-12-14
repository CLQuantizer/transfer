/**
 * File utility functions for the transfer application
 */

export interface FileMetadata {
    filename: string;
    size: number;
    type: string;
    lastModified: number;
}

/**
 * Get file icon emoji based on file extension
 */
export function getFileIcon(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const icons: Record<string, string> = {
        'pdf': '📄',
        'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️', 'svg': '🖼️',
        'mp4': '🎬', 'mov': '🎬', 'avi': '🎬', 'mkv': '🎬', 'webm': '🎬',
        'mp3': '🎵', 'wav': '🎵', 'ogg': '🎵', 'flac': '🎵', 'aac': '🎵',
        'zip': '📦', 'rar': '📦', '7z': '📦', 'tar': '📦', 'gz': '📦',
        'doc': '📝', 'docx': '📝', 'txt': '📝', 'rtf': '📝',
        'xls': '📊', 'xlsx': '📊', 'csv': '📊',
        'js': '💻', 'ts': '💻', 'py': '💻', 'html': '💻', 'css': '💻', 'json': '💻',
        'ppt': '📽️', 'pptx': '📽️',
        'md': '📋', 'markdown': '📋'
    };
    return icons[ext] || '📎';
}

/**
 * Format file size from bytes to human-readable string
 */
export function formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format upload/download speed from bytes per second
 */
export function formatSpeed(bytesPerSecond: number): string {
    if (bytesPerSecond === 0) return '';
    return formatFileSize(bytesPerSecond) + '/s';
}

/**
 * Format date to readable string
 */
export function formatDate(dateString: string | Date, includeTime: boolean = true): string {
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    const options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        ...(includeTime && { hour: '2-digit', minute: '2-digit' })
    };
    return date.toLocaleDateString('en-US', options);
}

/**
 * Get MIME type from filename
 */
export function getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
        // Images
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'svg': 'image/svg+xml',
        'ico': 'image/x-icon',
        // Videos
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo',
        'mkv': 'video/x-matroska',
        // Audio
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac',
        'aac': 'audio/aac',
        // Documents
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        // Text
        'txt': 'text/plain',
        'html': 'text/html',
        'css': 'text/css',
        'js': 'text/javascript',
        'json': 'application/json',
        'xml': 'application/xml',
        'md': 'text/markdown',
        // Archives
        'zip': 'application/zip',
        'rar': 'application/x-rar-compressed',
        '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip'
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Validate file before upload
 */
export function validateFile(file: File, maxSizeBytes?: number): { valid: boolean; error?: string } {
    // Check file size
    if (maxSizeBytes && file.size > maxSizeBytes) {
        return {
            valid: false,
            error: `File size exceeds limit of ${formatFileSize(maxSizeBytes)}`
        };
    }

    // Check if file has a name
    if (!file.name || file.name.trim() === '') {
        return {
            valid: false,
            error: 'File must have a name'
        };
    }

    // Check for empty files
    if (file.size === 0) {
        return {
            valid: false,
            error: 'Cannot upload empty file'
        };
    }

    return { valid: true };
}

/**
 * Generate a unique file key
 */
export function generateFileKey(filename: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    return `${timestamp}-${random}-${sanitizedFilename}`;
}

/**
 * Extract filename from R2 key (removes timestamp prefix)
 */
export function extractFilename(key: string): string {
    // Key format: timestamp-random-filename
    const parts = key.split('-');
    if (parts.length >= 3) {
        return parts.slice(2).join('-');
    }
    return key;
}

/**
 * Check if file type is viewable in browser
 */
export function isViewableType(filename: string): boolean {
    const ext = filename.split('.').pop()?.toLowerCase() || '';
    const viewableTypes = [
        'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg',
        'mp4', 'webm', 'mov',
        'pdf',
        'txt', 'md', 'html', 'css', 'js', 'json'
    ];
    return viewableTypes.includes(ext);
}

/**
 * Calculate estimated upload time
 */
export function estimateUploadTime(fileSize: number, uploadSpeed: number): number {
    if (uploadSpeed === 0) return 0;
    return Math.ceil(fileSize / uploadSpeed);
}

/**
 * Format estimated time remaining
 */
export function formatTimeRemaining(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
}

