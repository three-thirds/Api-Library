<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	import Header from '$lib/components/header.svelte';
	import Footer from '$lib/components/footer.svelte';

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<div class="flex min-h-screen flex-col p-2">
	<Header />
	<main class="flex-1">
		{@render children()}
	</main>
	<Footer />
</div>
