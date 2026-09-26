<script lang="ts">;
    let { data } = $props();
    const api = data.api
    const pageUrl = `https://api-library.vercel.app/docs/${api.id}`;
</script>

<svelte:head>
    <title>{api.name} - Threethirds API</title>
    <meta name="description" content={api.description} />

    <meta property="og:title" content={api.name} />
    <meta property="og:description" content={api.description} />
    <meta property="og:url" content={pageUrl} />
    <meta property="og:type" content="website" />

    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content={api.name} />
    <meta name="twitter:description" content={api.description} />
</svelte:head>

<p>{data.api.name}</p>