<script lang="ts">
    import { Button } from "$lib/components/ui/button/index";
    import {invalidateAll} from "$app/navigation";

    interface R2File {
        key: string;
        filename: string;
        size: number;
        uploadedAt: string;
        etag: string;
        httpEtag: string;
    }

    export let data: { files: R2File[] };
    let fileInput: HTMLInputElement;
    let uploadArea: HTMLDivElement;
    let uploading = false;
    let uploadProgress = 0;
    let uploadSpeed = 0;
    let uploadingFileName = '';
    let dragOver = false;
    let files = data.files;
    let copiedKey = '';

    const getFileIcon = (filename: string): string => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const icons: Record<string, string> = {
            'pdf': '📄',
            'jpg': '🖼️', 'jpeg': '🖼️', 'png': '🖼️', 'gif': '🖼️', 'webp': '🖼️',
            'mp4': '🎬', 'mov': '🎬', 'avi': '🎬', 'mkv': '🎬',
            'mp3': '🎵', 'wav': '🎵', 'ogg': '🎵',
            'zip': '📦', 'rar': '📦', '7z': '📦',
            'doc': '📝', 'docx': '📝', 'txt': '📝',
            'xls': '📊', 'xlsx': '📊', 'csv': '📊',
            'code': '💻', 'js': '💻', 'ts': '💻', 'py': '💻', 'html': '💻', 'css': '💻'
        };
        return icons[ext] || '📎';
    };

    const handleUpload = async (file: File) => {
        if (!file) return;

        uploading = true;
        uploadProgress = 0;
        uploadSpeed = 0;
        uploadingFileName = file.name;
        const formData = new FormData();
        formData.append('file', file, file.name);

        const startTime = Date.now();
        let lastLoaded = 0;
        let lastTime = startTime;

        return new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    uploadProgress = Math.round((e.loaded / e.total) * 100);
                    
                    // Calculate speed
                    const now = Date.now();
                    const timeDiff = (now - lastTime) / 1000; // seconds
                    if (timeDiff > 0.1) { // Update every 100ms
                        const loadedDiff = e.loaded - lastLoaded;
                        uploadSpeed = loadedDiff / timeDiff; // bytes per second
                        lastLoaded = e.loaded;
                        lastTime = now;
                    }
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        const response: R2File = JSON.parse(xhr.responseText);
                        files = [...files, response];
                        fileInput.value = '';
                        resolve();
                    } catch (err) {
                        reject(new Error('Failed to parse response'));
                    }
                } else {
                    reject(new Error(`Upload failed: ${xhr.statusText}`));
                }
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed. Please try again.'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload cancelled'));
            });

            xhr.open('POST', '/private/upload');
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.send(formData);
        }).catch((error) => {
            console.error('Upload failed:', error);
            alert(error.message || 'Upload failed. Please try again.');
        }).finally(async () => {
            uploading = false;
            uploadProgress = 0;
            uploadSpeed = 0;
            uploadingFileName = '';
            await invalidateAll();
        });
    };

    const handleFileSelect = () => {
        if (!fileInput.files?.length) return;
        handleUpload(fileInput.files[0]);
    };

    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        dragOver = true;
    };

    const handleDragLeave = () => {
        dragOver = false;
    };

    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        dragOver = false;
        
        if (uploading) return;
        
        const droppedFiles = e.dataTransfer?.files;
        if (droppedFiles && droppedFiles.length > 0) {
            handleUpload(droppedFiles[0]);
        }
    };

    const copyLink = async (key: string) => {
        const url = `${window.location.origin}/private/download/${key}`;
        try {
            await navigator.clipboard.writeText(url);
            copiedKey = key;
            setTimeout(() => {
                copiedKey = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleDownload = async (key: string, filename: string) => {
        try {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
            const fileType = filename.split('.').pop()?.toLowerCase();

            // Media types that should be viewed in browser
            const viewableTypes = ['mp4', 'jpg', 'jpeg', 'png', 'gif', 'pdf'];

            if (isIOS && viewableTypes.includes(fileType || '')) {
                // For iOS media files - open in new tab
                window.open(`/private/download/${key}`, '_blank');
            } else {
                // For non-iOS or non-media files, try to download
                const response = await fetch(`/private/download/${key}`);
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Download failed:', error);
            alert('Download failed. Please try again.');
        } finally {
            await invalidateAll();
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatSpeed = (bytesPerSecond: number): string => {
        if (bytesPerSecond === 0) return '';
        return formatFileSize(bytesPerSecond) + '/s';
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };
</script>

<div class="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
    <div class="container mx-auto px-4 py-8 max-w-5xl">
        <div class="space-y-8">
            <!-- Header -->
            <div class="text-center space-y-2 mb-8">
                <h1 class="text-4xl md:text-5xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    File Transfer
                </h1>
                <p class="text-muted-foreground">Upload and share files instantly</p>
            </div>

            <!-- Upload Area with Drag & Drop -->
            <div
                bind:this={uploadArea}
                class="group relative border-2 border-dashed rounded-2xl p-12 transition-all duration-300 
                       {dragOver 
                         ? 'border-primary bg-primary/10 scale-[1.02] shadow-lg shadow-primary/20' 
                         : 'border-border hover:border-primary/50 bg-card/50 backdrop-blur-sm hover:shadow-xl'} 
                       overflow-hidden"
                on:dragover={handleDragOver}
                on:dragleave={handleDragLeave}
                on:drop={handleDrop}
            >
                <!-- Animated background gradient -->
                <div class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                    <div class="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5"></div>
                </div>
                
                <input
                    bind:this={fileInput}
                    type="file"
                    class="hidden"
                    on:change={handleFileSelect}
                />
                
                {#if uploading}
                    <div class="relative space-y-6">
                        <div class="flex items-center space-x-4">
                            <div class="flex-shrink-0 w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center text-3xl animate-pulse">
                                {getFileIcon(uploadingFileName)}
                            </div>
                            <div class="flex-1 min-w-0">
                                <p class="font-semibold text-lg truncate">{uploadingFileName}</p>
                                <p class="text-sm text-muted-foreground mt-1">
                                    {uploadProgress}% {uploadSpeed > 0 ? `• ${formatSpeed(uploadSpeed)}` : ''}
                                </p>
                            </div>
                        </div>
                        <div class="relative w-full bg-muted rounded-full h-3 overflow-hidden">
                            <div
                                class="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/80 rounded-full transition-all duration-300 ease-out shadow-sm"
                                style="width: {uploadProgress}%"
                            >
                                <div class="absolute inset-0 bg-white/20 animate-pulse"></div>
                            </div>
                        </div>
                    </div>
                {:else}
                    <div class="relative text-center space-y-6">
                        <div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 text-5xl transform transition-transform group-hover:scale-110 duration-300">
                            📤
                        </div>
                        <div class="space-y-3">
                            <div>
                                <p class="text-xl font-semibold mb-1">Drag & drop files here</p>
                                <p class="text-sm text-muted-foreground">or click the button below</p>
                            </div>
                            <Button
                                disabled={uploading}
                                on:click={() => fileInput.click()}
                                class="px-8 py-6 text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300"
                            >
                                Choose File
                            </Button>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Files List -->
            {#if files.length === 0}
                <div class="text-center py-16 space-y-4">
                    <div class="inline-flex items-center justify-center w-24 h-24 rounded-full bg-muted text-5xl">
                        📁
                    </div>
                    <div class="space-y-2">
                        <p class="text-xl font-semibold text-foreground">No files yet</p>
                        <p class="text-muted-foreground">Upload your first file to get started</p>
                    </div>
                </div>
            {:else}
                <div class="space-y-4">
                    <div class="flex items-center justify-between">
                        <h2 class="text-2xl font-bold">Your Files</h2>
                        <span class="px-3 py-1 rounded-full bg-primary/10 text-sm font-medium text-primary">
                            {files.length} {files.length === 1 ? 'file' : 'files'}
                        </span>
                    </div>
                    <div class="grid gap-3">
                        {#each files as file, index (file.key)}
                            <div class="group relative flex items-center justify-between p-5 bg-card border border-border rounded-xl 
                                       hover:border-primary/50 hover:shadow-lg transition-all duration-300 
                                       hover:-translate-y-0.5 backdrop-blur-sm animate-fade-in"
                                 style="animation-delay: {index * 50}ms">
                                <div class="flex items-center space-x-4 flex-1 min-w-0">
                                    <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl 
                                              group-hover:scale-110 transition-transform duration-300">
                                        {getFileIcon(file.filename)}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <h3 class="font-semibold text-base truncate group-hover:text-primary transition-colors">
                                            {file.filename}
                                        </h3>
                                        <div class="flex items-center space-x-3 text-sm text-muted-foreground mt-1.5">
                                            <span class="flex items-center">
                                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                                                </svg>
                                                {formatFileSize(file.size)}
                                            </span>
                                            <span>•</span>
                                            <span class="flex items-center">
                                                <svg class="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                </svg>
                                                {formatDate(file.uploadedAt)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex items-center space-x-2 flex-shrink-0 ml-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        on:click={() => copyLink(file.key)}
                                        title="Copy link"
                                        class="h-9 w-9 p-0 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                                    >
                                        {#if copiedKey === file.key}
                                            <span class="text-green-500">✓</span>
                                        {:else}
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                                            </svg>
                                        {/if}
                                    </Button>
                                    <Button
                                        size="sm"
                                        on:click={() => handleDownload(file.key, file.filename)}
                                        class="px-4 h-9 font-medium shadow-sm hover:shadow-md transition-all duration-300"
                                    >
                                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                        </svg>
                                        Download
                                    </Button>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>