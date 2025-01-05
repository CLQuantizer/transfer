<script lang="ts">
    import { Button } from "$lib/components/ui/button/index";
    import ky from "ky";
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
    let uploading = false;
    let files = data.files;

    const handleUpload = async () => {
        if (!fileInput.files?.length) return;

        uploading = true;
        const formData = new FormData();

        // Get the file and ensure it has a name
        const file = fileInput.files[0];
        formData.append('file', file, file.name);

        try {
            const response = await ky.post('/private/upload', {
                body: formData,
                timeout: false, // Disable timeout for large files
                headers: {
                    'Accept': 'application/json'
                }
            }).json<R2File>();

            files = [...files, response];
            fileInput.value = '';
        } catch (error) {
            console.error('Upload failed:', error);
            alert('Upload failed. Please try again.');
        } finally {
            uploading = false;
            await invalidateAll();
        }
    };

    const handleDownload = async (key: string, filename: string) => {
        try {
            // Check if iOS
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

            if (isIOS) {
                // For iOS, open in a new tab directly
                window.open(`/private/download/${key}`, '_blank');
            } else {
                // For other platforms, use the blob approach
                const response = await ky.get(`/private/download/${key}`);
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
        }
    };

    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };
</script>

<div class="container mx-auto p-6">
    <div class="space-y-6">
        <h1 class="text-2xl font-bold">Files</h1>

        <div class="flex items-center space-x-4">
            <input
                    bind:this={fileInput}
                    type="file"
                    class="hidden"
                    on:change={handleUpload}
            />
            <Button
                    disabled={uploading}
                    on:click={() => fileInput.click()}
            >
                {uploading ? 'Uploading...' : 'Upload File'}
            </Button>
        </div>

        {#if data.files.length === 0}
            <p>No files available.</p>
        {:else}
            <div class="space-y-4">
                {#each data.files as file}
                    <div class="flex items-center justify-between p-4 bg-secondary rounded-lg">
                        <div class="flex items-center space-x-4">
                            <div class="space-y-1">
                                <h3 class="font-medium">{file.filename}</h3>
                                <div class="flex space-x-4 text-sm text-gray-500">
                                    <span>{formatFileSize(file.size)}</span>
                                    <span>•</span>
                                    <span>{formatDate(file.uploadedAt)}</span>
                                </div>
                            </div>
                        </div>

                        <Button on:click={() => handleDownload(file.key, file.filename)}>
                            Download
                        </Button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>