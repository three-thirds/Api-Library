<script lang="ts">
	import Tryapi from "$lib/components/tryapi.svelte";
	import { Button } from "$lib/components/ui/button/index.js";
	import type { ApiEntry } from "$lib/types";

	let { api }: { api: ApiEntry } = $props();

	const methods: Record<string, string> = {
		GET: "text-green-500",
		POST: "text-blue-500",
	};

	let copied = $state(false);

	async function copyRoute() {
		try {
			await navigator.clipboard.writeText(api.route);
			copied = true;
			setTimeout(() => {
				copied = false;
			}, 1200);
		} catch {
			// clipboard can fail on http or denied permission; leave the chip as-is
		}
	}
</script>

<article id={api.id} class="rounded-lg border border-border p-4">
	<div class="flex items-start justify-between gap-4">
		<div>
			<div class="flex items-center gap-2">
				<h2 class="text-xl font-semibold">
					{api.name}
				</h2>
				{#if api.auth}
					<span class="rounded-full border border-border px-2 py-0.5 text-xs text-muted-foreground">
						Api Required
					</span>
				{/if}
			</div>
			<p class="mt-1 text-sm text-muted-foreground">{api.description}</p>
			<Button variant="outline" size="sm" class="mt-2" href={`/docs/${api.id}`}>
				View Docs
			</Button>
		</div>
		<button
			type="button"
			class="shrink-0 rounded-md bg-muted px-2 py-1 text-xs font-medium flex items-center gap-1.5 text-left hover:bg-muted/80"
			title="Copy route"
			onclick={copyRoute}
		>
			<span class={`font-semibold ${methods[api.method] || "text-gray-500"}`}>{api.method}</span>
			<code>{api.route}</code>
			{#if copied}
				<span class="text-muted-foreground">copied</span>
			{/if}
		</button>
	</div>

	{#if api.params.length > 0}
		<div class="mt-5">
			<h3 class="mb-2 text-xs font-medium uppercase text-muted-foreground tracking-wide">Parameters</h3>
		</div>
		<div class="divide-y divide-border rounded-lg border border-border">
			{#each api.params as param (param.name)}
				<div class="p-3">
					<div class="flex flex-wrap items-center gap-2">
						<code class="text-sm font-medium">{param.name}</code>
						<code class="text-xs text-muted-foreground">{param.type}</code>
						{#if param.required}
							<span class="rounded-full bg-[#d98014]/10 px-2 py-0.67 text-xs font-medium text-[#d98014]">Required</span>
						{/if}
					</div>
					<p class="mt-2 text-sm text-muted-foreground">{param.description}</p>
					<p class="mt-0.5 text-sm text-muted-foreground">Example: <code>{param.example}</code></p>
				</div>
			{/each}
		</div>
	{/if}

	{#if api.response || api.errors.length > 0}
		<div class="mt-5">
			<h3 class="mb-2 text-xs font-medium uppercase text-muted-foreground tracking-wide">
				Responses
			</h3>

			<div class="divide-y divide-border rounded-lg border border-border">
				{#if api.response}
					<div class="p-3 bg-muted/20">
						<div class="flex items-center gap-3">
							<span class="rounded-md bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-500">
								200
							</span>
							<code class="text-sm font-semibold">OK</code>
							<span class="text-sm text-muted-foreground">Success</span>
						</div>
						<pre class="mt-2.5 overflow-x-auto rounded-md bg-muted/60 p-3 text-xs font-mono text-foreground leading-relaxed"><code>{JSON.stringify(api.response, null, 2)}</code></pre>
					</div>
				{/if}
				{#each api.errors as res, i (i)}
					<div class="flex items-center gap-3 p-3">
						<span class="rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
							{res.status}
						</span>
						<code class="text-sm">{res.code}</code>
						<span class="text-sm text-muted-foreground">{res.message}</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
	<Tryapi {api} />
</article>
