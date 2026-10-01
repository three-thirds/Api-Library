<script lang="ts">
	import * as Dialog from "$lib/components/ui/dialog/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Input } from "$lib/components/ui/input/index.js";
	import { untrack } from "svelte";
	import type { ApiEntry } from "$lib/types";

	let { api }: { api: ApiEntry } = $props();

	let open = $state(false);
	let values = $state<Record<string, string>>(
		untrack(() =>
			Object.fromEntries((api.params ?? []).map((param) => [param.name, param.example ?? ""])),
		),
	);

	let loading = $state(false);
	let responseText = $state("");
	let status = $state<number | null>(null);
	let requestUrl = $state("");

	async function send() {
		if (api.auth) {
			status = null;
			requestUrl = "";
			responseText = "This one needs an API key. Try is not wired for auth yet.";
			return;
		}

		if ((api.method || "GET").toUpperCase() !== "GET") {
			status = null;
			requestUrl = "";
			responseText = "Try only sends GET for now.";
			return;
		}

		loading = true;
		responseText = "";
		status = null;
		requestUrl = "";

		try {
			let path = api.route;
			const query = new URLSearchParams();

			for (const param of api.params ?? []) {
				const val = (values[param.name] ?? "").trim();
				const token = `:${param.name}`;

				if (path.includes(token)) {
					if (!val) {
						status = 400;
						responseText = `missing ${param.name}`;
						return;
					}
					path = path.split(token).join(encodeURIComponent(val));
				} else if (val !== "") {
					query.set(param.name, val);
				}
			}

			const qs = query.toString();
			const url = qs ? `${path}?${qs}` : path;
			requestUrl = url;

			const res = await fetch(url, { method: "GET" });
			status = res.status;
			const text = await res.text();

			try {
				responseText = JSON.stringify(JSON.parse(text), null, 2);
			} catch {
				responseText = text;
			}
		} catch (err) {
			status = null;
			responseText = String(err);
		} finally {
			loading = false;
		}
	}
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger
		class="mt-4 inline-flex items-center gap-2 rounded-md border border-border bg-secondary/60 px-3 py-1.5 text-xs font-medium text-foreground shadow-sm transition-all hover:bg-secondary hover:border-foreground/20"
	>
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="13"
			height="13"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2.5"
			stroke-linecap="round"
			stroke-linejoin="round"
			class="text-green-500"
		>
			<polygon points="5 3 19 12 5 21 5 3" />
		</svg>
		Try Endpoint
	</Dialog.Trigger>

	<Dialog.Content class="sm:max-w-lg">
		<Dialog.Header>
			<div class="flex items-center gap-2">
				<span class="rounded bg-muted px-2 py-0.5 text-xs font-mono font-semibold text-green-500"
					>{api.method}</span
				>
				<code class="text-xs font-mono text-muted-foreground">{api.route}</code>
			</div>
			<Dialog.Title class="text-lg font-semibold mt-1">Test {api.name}</Dialog.Title>
			<Dialog.Description class="text-sm text-muted-foreground">
				{api.description}
			</Dialog.Description>
		</Dialog.Header>

		{#if api.auth}
			<p class="py-2 text-sm text-muted-foreground">
				Marked as API required. Send is disabled until auth is wired into Try.
			</p>
		{:else if api.params && api.params.length > 0}
			<div class="space-y-3 py-2">
				<h4 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parameters</h4>
				{#each api.params as param (param.name)}
					<div class="space-y-1">
						<label for={param.name} class="text-xs font-medium text-foreground flex items-center justify-between">
							<span>{param.name}</span>
							{#if param.required}
								<span class="text-[10px] text-amber-500 font-semibold uppercase">Required</span>
							{/if}
						</label>
						<Input
							id={param.name}
							placeholder={param.example ?? `Enter ${param.name}...`}
							bind:value={values[param.name]}
							class="h-8 text-xs font-mono"
						/>
					</div>
				{/each}
			</div>
		{/if}

		{#if status !== null || responseText}
			<div class="mt-2 space-y-2">
				{#if requestUrl}
					<code class="block text-[11px] text-muted-foreground break-all">{requestUrl}</code>
				{/if}
				{#if status !== null}
					<span
						class="inline-block rounded-md px-2 py-0.5 text-xs font-medium {status >= 200 && status < 300
							? 'bg-green-500/10 text-green-500'
							: 'bg-destructive/10 text-destructive'}"
					>
						{status}
					</span>
				{/if}
				<pre
					class="max-h-64 overflow-auto rounded-md bg-muted/60 p-3 text-xs font-mono leading-relaxed"
				><code>{responseText}</code></pre>
			</div>
		{/if}

		<Dialog.Footer class="mt-4">
			<Button size="sm" onclick={send} disabled={loading || api.auth} class="w-full sm:w-auto">
				{#if loading}
					Testing...
				{:else}
					Send Request
				{/if}
			</Button>
		</Dialog.Footer>
	</Dialog.Content>
</Dialog.Root>
