<script>
    import "../app.css";
    import {ModeWatcher} from "mode-watcher";
</script>

<ModeWatcher />
<div class="w-full h-full flex flex-col justify-center items-center">
    <slot />
</div>
<style>
    :global(body) {
        font-family: 'Noto Sans SC', sans-serif;
    }
</style>