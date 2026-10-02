<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
</script>

<svelte:head>
	<title>three thirds</title>
</svelte:head>

<div class="mx-auto max-w-3xl p-6">
	<h1 class="text-xl font-semibold">three thirds</h1>
	<p class="mt-2 text-sm text-muted-foreground">
		Public APIs under /api/v1. The docs page lists each one, the query params, and what it returns.
	</p>
	<div class="mt-4">
		<Button href="/docs">Docs</Button>
	</div>
</div>
