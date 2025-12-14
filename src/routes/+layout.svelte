<script>
    import "../app.css";
    import {ModeWatcher} from "mode-watcher";
</script>

<ModeWatcher />
<div class="w-full min-h-screen">
    <slot />
</div>
<style>
    :global(body) {
        font-family: 'Noto Sans SC', sans-serif;
    }
    
    :global(*) {
        @apply antialiased;
    }
</style>