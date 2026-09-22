<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	import Header from '$lib/components/header.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div>
	<Header />
	{@render children()}
</div>
