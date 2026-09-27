<script lang="ts">
	  let { api }: { api: any } = $props();

    const methods: Record<string, string> = {
        GET: "#4ade80",
        POST: "#60a5fa",
    }
</script>

<div class="relative flex h-full w-full flex-col bg-[#09090b] p-4 text-white">
	<div class="absolute top-4 right-6 text-xl">Threethirds API</div>
	<div class="flex flex-1 flex-col justify-center px-10">
		<div class="mb-5 text-xl uppercase tracking-wide">
			{api.category}
		</div>
		<div class="text-8xl font-bold leading-tight">
			{api.name}
		</div>
		<div class="mt-6 max-w-3xl text-3xl">
			{api.description}
		</div>

		<div class="mt-12 flex items-center gap-4">
			<div class="rounded-xl px-6 py-2.5 text-2xl font-semibold"
			style={`background-color: ${methods[api.method] ?? '#9ca3af'}1a; color: ${methods[api.method] ?? '#9ca3af'};`}>
				{api.method}
			</div>
			<div class="text-2xl">
				{api.route}
			</div>
		</div>
	</div>
</div>

