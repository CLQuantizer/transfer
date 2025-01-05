<script lang="ts">
    import { Button } from "$lib/components/ui/button/index";
    import ky from 'ky';
    import { onMount } from 'svelte';

    let files: FileList | null = null;
    let uploading = false;
    let progress = 0;
    let previewUrl: string | null = null;
    let error: string | null = null;

    const handleFileSelect = (event: Event) => {
        const input = event.target as HTMLInputElement;
        files = input.files;
        error = null;

        if (files && files[0]) {
            // Create preview for images
            if (files[0].type.startsWith('image/')) {
                previewUrl = URL.createObjectURL(files[0]);
            } else {
                previewUrl = null;
            }
        }
    };

    const uploadFile = async () => {
        if (!files || files.length === 0) {
            error = "Please select a file first";
            return;
        }

        const file = files[0];
        const formData = new FormData();
        formData.append('file', file);

        try {
            uploading = true;
            progress = 0;

            await ky.post('/private/upload', {
                body: formData,
            });

            // Clear form after successful upload
            files = null;
            previewUrl = null;
            error = null;
        } catch (err) {
            error = "Upload failed. Please try again.";
            console.error('Upload error:', err);
        } finally {
            uploading = false;
        }
    };

    onMount(() => {
        // Cleanup preview URL when component is destroyed
        return () => {
            if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
            }
        };
    });
</script>

<div class="container mx-auto p-6">
    <div class="space-y-4">
        <!-- File Input -->
        <div class="space-y-2">
            <input
                    type="file"
                    class="block w-full text-sm text-slate-500
                       file:mr-4 file:py-2 file:px-4
                       file:rounded-full file:border-0
                       file:text-sm file:font-semibold
                       file:bg-violet-50 file:text-violet-700
                       hover:file:bg-violet-100"
                    on:change={handleFileSelect}
                    accept="image/*,.pdf,.doc,.docx"
            />

            {#if error}
                <p class="text-red-500 text-sm">{error}</p>
            {/if}
        </div>

        <!-- Preview -->
        {#if previewUrl}
            <div class="max-w-xs">
                <img src={previewUrl} alt="Preview" class="rounded-lg shadow-md" />
            </div>
        {/if}

        <!-- Upload Button -->
        <Button on:click={uploadFile}
                disabled={uploading || !files}>
            {#if uploading}
                Uploading... {progress}%
            {:else}
                Upload File
            {/if}
        </Button>
    </div>
</div>