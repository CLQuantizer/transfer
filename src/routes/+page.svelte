<script lang="ts">
    import { Button } from "$lib/components/ui/button/index";

    interface R2File {
        key: string;
        filename: string;
        size: number;
        uploadedAt: string;
        etag: string;
        httpEtag: string;
    }

    export let data: { files: R2File[] };

    // Helper function to format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Helper function to format date
    const formatDate = (dateString: string): string => {
        return new Date(dateString).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    // Helper to get file type icon/label
    const getFileType = (filename: string): string => {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        return ext.toUpperCase();
    };
</script>

<div class="container mx-auto p-6">
    <div class="space-y-6">
        <h1 class="text-2xl font-bold text-slate-900">Files</h1>

        {#if data.files.length === 0}
            <p class="text-slate-500">No files available.</p>
        {:else}
            <div class="space-y-4">
                {#each data.files as file}
                    <div class="flex items-center justify-between p-4 bg-white rounded-lg shadow hover:shadow-md transition-shadow">
                        <div class="flex items-center space-x-4">
                            <!-- File type indicator -->
                            <div class="w-10 h-10 flex items-center justify-center bg-violet-50 rounded-lg">
                                <span class="text-violet-700 text-sm font-medium">
                                    {getFileType(file.filename)}
                                </span>
                            </div>

                            <!-- File details -->
                            <div class="space-y-1">
                                <h3 class="text-slate-900 font-medium">{file.filename}</h3>
                                <div class="flex space-x-4 text-sm text-slate-500">
                                    <span>{formatFileSize(file.size)}</span>
                                    <span>•</span>
                                    <span>{formatDate(file.uploadedAt)}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Download button -->
                        <Button
                                href={`/api/download/${file.key}`}
                                variant="outline"
                                class="ml-4"
                        >
                            Download
                        </Button>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>