<script lang="ts">
    import apis from "$lib/apis.json";
</script>

{#each apis as api (api.id)}
    {api.name}
{/each}