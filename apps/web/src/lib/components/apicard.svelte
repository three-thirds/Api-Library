<script lang="ts">
    import apis from "$lib/apis.json";
</script>

<div class="flex flex-col gap-4">
    {#each apis as api (api.id)}
        <div class="flex flex-col gap-2 rounded-lg border bg-background p-4">
            
        </div>
    {/each}

</div>