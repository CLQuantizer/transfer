<script lang="ts">
    import { Button } from "$lib/components/ui/button/index";
    import {invalidateAll} from "$app/navigation";
    import { 
        getFileIcon, 
        formatFileSize, 
        formatSpeed, 
        formatDate, 
        validateFile,
        isViewableType,
        formatTimeRemaining,
        estimateUploadTime
    } from "$lib/file-utils";

    interface R2File {
        key: string;
        filename: string;
        size: number;
        uploadedAt: string;
        etag: string;
        httpEtag: string;
        shortKey?: string;
        expiresAt?: string;
        downloadCount?: number;
    }

    export let data: { files: R2File[] };
    let fileInput: HTMLInputElement;
    let uploadArea: HTMLDivElement;
    let uploading = false;
    let uploadProgress = 0;
    let uploadSpeed = 0;
    let uploadingFileName = '';
    let uploadingFileSize = 0;
    let dragOver = false;
    let files = data.files;
    let copiedKey = '';
    let searchQuery = '';
    let deletingKey: string | null = null;

    // Filter files based on search query
    $: filteredFiles = searchQuery 
        ? files.filter(file => 
            file.filename.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : files;

    const handleUpload = async (file: File) => {
        if (!file) return;

        // Validate file
        const maxSize = 100 * 1024 * 1024; // 100MB
        const validation = validateFile(file, maxSize);
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        uploading = true;
        uploadProgress = 0;
        uploadSpeed = 0;
        uploadingFileName = file.name;
        uploadingFileSize = file.size;
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
            uploadingFileSize = 0;
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

    const copyLink = async (file: R2File) => {
        // Prefer short link if available, otherwise use full key
        const linkKey = file.shortKey || file.key;
        const url = `${window.location.origin}/private/download/${linkKey}`;
        try {
            await navigator.clipboard.writeText(url);
            copiedKey = file.key;
            setTimeout(() => {
                copiedKey = '';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const isExpired = (file: R2File): boolean => {
        if (!file.expiresAt) return false;
        return new Date(file.expiresAt) < new Date();
    };

    const handleDownload = async (key: string, filename: string) => {
        try {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

            if (isIOS && isViewableType(filename)) {
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

    const handleDelete = async (key: string) => {
        if (!confirm('Are you sure you want to delete this file?')) return;
        
        deletingKey = key;
        try {
            const response = await fetch(`/private/delete/${key}`, {
                method: 'DELETE'
            });
            
            if (!response.ok) {
                throw new Error('Delete failed');
            }
            
            files = files.filter(f => f.key !== key);
        } catch (error) {
            console.error('Delete failed:', error);
            alert('Failed to delete file. Please try again.');
        } finally {
            deletingKey = null;
            await invalidateAll();
        }
    };
</script>

<div class="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
    <div class="container mx-auto px-4 py-8 max-w-4xl">
        <div class="space-y-6">
            <!-- Upload Area with Drag & Drop -->
            <div
                bind:this={uploadArea}
                class="group relative border-2 border-dashed rounded-2xl p-8 sm:p-12 transition-all duration-300 
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
                                    {uploadSpeed > 0 && uploadProgress < 100 ? ` • ${formatTimeRemaining(estimateUploadTime((uploadingFileSize * (100 - uploadProgress) / 100), uploadSpeed))}` : ''}
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
                    <div class="flex items-center justify-end">
                        <span class="px-3 py-1 rounded-full bg-primary/10 text-sm font-medium text-primary">
                            {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
                        </span>
                    </div>
                    
                    <!-- Search Bar -->
                    {#if files.length > 0}
                        <div class="relative">
                            <input
                                type="text"
                                placeholder="Search files..."
                                bind:value={searchQuery}
                                class="w-full px-4 py-2 pl-10 rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                            />
                            <svg class="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                    {/if}
                    
                    <div class="grid gap-3">
                        {#if filteredFiles.length === 0 && searchQuery}
                            <div class="text-center py-8 text-muted-foreground">
                                <p>No files found matching "{searchQuery}"</p>
                            </div>
                        {/if}
                        {#each filteredFiles as file, index (file.key)}
                            <div class="group relative bg-card border border-border rounded-xl 
                                       hover:border-primary/50 hover:shadow-lg transition-all duration-300 
                                       hover:-translate-y-0.5 backdrop-blur-sm animate-fade-in overflow-hidden"
                                 style="animation-delay: {index * 50}ms">
                                <div class="flex flex-col sm:flex-row sm:items-center gap-4 p-4 sm:p-5">
                                    <div class="flex items-start space-x-4 flex-1 min-w-0">
                                        <div class="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-2xl 
                                                  group-hover:scale-110 transition-transform duration-300">
                                            {getFileIcon(file.filename)}
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <div class="flex flex-wrap items-center gap-2 mb-2">
                                                <h3 class="font-semibold text-base truncate group-hover:text-primary transition-colors max-w-full">
                                                    {file.filename}
                                                </h3>
                                                {#if file.shortKey}
                                                    <span class="px-2 py-0.5 text-xs rounded-full bg-primary/10 text-primary font-mono flex-shrink-0">
                                                        {file.shortKey}
                                                    </span>
                                                {/if}
                                                {#if isExpired(file)}
                                                    <span class="px-2 py-0.5 text-xs rounded-full bg-destructive/10 text-destructive flex-shrink-0">
                                                        Expired
                                                    </span>
                                                {:else if file.expiresAt}
                                                    <span class="px-2 py-0.5 text-xs rounded-full bg-orange-500/10 text-orange-500 flex-shrink-0">
                                                        Expires {formatDate(file.expiresAt, false)}
                                                    </span>
                                                {/if}
                                            </div>
                                            <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                                <span class="flex items-center whitespace-nowrap">
                                                    <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path>
                                                    </svg>
                                                    {formatFileSize(file.size)}
                                                </span>
                                                <span class="hidden sm:inline">•</span>
                                                <span class="flex items-center whitespace-nowrap">
                                                    <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                                    </svg>
                                                    {formatDate(file.uploadedAt)}
                                                </span>
                                                {#if file.downloadCount !== undefined && file.downloadCount > 0}
                                                    <span class="hidden sm:inline">•</span>
                                                    <span class="flex items-center whitespace-nowrap">
                                                        <svg class="w-4 h-4 mr-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                                        </svg>
                                                        {file.downloadCount} {file.downloadCount === 1 ? 'download' : 'downloads'}
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>

                                    <div class="flex items-center justify-end sm:justify-start space-x-2 flex-shrink-0 sm:ml-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        on:click={() => copyLink(file)}
                                        title="Copy shareable link"
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
                                        on:click={() => handleDownload(file.shortKey || file.key, file.filename)}
                                        disabled={isExpired(file)}
                                        class="px-4 h-9 font-medium shadow-sm hover:shadow-md transition-all duration-300"
                                    >
                                        <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                                        </svg>
                                        Download
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        on:click={() => handleDelete(file.key)}
                                        disabled={deletingKey === file.key}
                                        title="Delete file"
                                        class="h-9 w-9 p-0 rounded-lg hover:bg-destructive/10 hover:text-destructive transition-colors"
                                    >
                                        {#if deletingKey === file.key}
                                            <svg class="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path>
                                            </svg>
                                        {:else}
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                                            </svg>
                                        {/if}
                                    </Button>
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    </div>
</div>