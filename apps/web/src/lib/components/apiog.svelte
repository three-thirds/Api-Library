<script lang="ts">
	let { api }: {api: any} = $props();

	const methods: Record<string, string> = {
		GET: "#4ade80",
		POST: "#60a5fa"
		// do rest later @willgob	
	}

	const methodColor = methods[api.method] || "#f87171";
</script>

<div class="relative flex h-full w-full overflow-hidden bg-[#09090b] p-12 text-white">
	<!-- <div class="absolu" -->
</div>