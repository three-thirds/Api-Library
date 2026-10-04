<script lang="ts">
	let { api }: {api: any} = $props();

	const methods: Record<string, string> = {
		GET: "#4ade80",
		POST: "#60a5fa"
		// do rest later @willgob	
	}

	const methodColor = methods[api.method] || "#f87171";
</script>

<div class="relative flex h-full w-full overflow-hidden bg-[#09090b] p-12 text-white flex-col justify-center">

	<div class="absolute top-12 right-16 text-2xl text-[#9f9fa9] font-semibold">
		Threethirds API
	</div>

	<article id={api.id} class="rounded-lg border-2 border-[#ffffff1a] p-4 flex flex-col gap-4">
		<div class="flex items-start justify-between gap-4">
			<div class="flex flex-col gap-2">
				<div class="flex items-center gap-2">
					<h2 class="text-9xl font-semibold">
						{api.name}
					</h2>
					{#if api.auth}
						<span class="rounded-full border border-[#ffffff1a] px-2 py-0.5 text-base text-[#9f9fa9]">
							Api Required
						</span>
					{/if}
				</div>
				<p class="mt-1 text-xm text-[#9f9fa9]">{api.description}</p>         
				<div class="mt-2">
					View Docs
				</div>           
			</div>
			<code class="shrink-0 rounded-md bg-[#27272a] px-2 py-1 text-base font-medium flex items-center gap-1.5">
				<span class="font-semibold" style={`color: ${methodColor}`}>{api.method}</span>
				{api.route}
			</code>
		</div>
	</article>

	<footer class="absolute bottom-5 left-8 flex items-center justify-between gap-2 border-t bg-background/50 p-2">
		<p class="text-xs text-muted-foreground">
			Made with ❤️ by Three Thirds
		</p>
	</footer>
</div>

        