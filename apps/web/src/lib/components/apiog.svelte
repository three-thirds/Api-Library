<script lang="ts">
	  let { api }: { api: any } = $props();
</script>

<div class="relative flex h-full w-full flex-col bg-[#09090b] p-16">
	<div class="absolute inset-6 border-2 border-dashed border-white/25"></div>

	<div class="absolute top-12 right-16 text-4xl text-white">
		Threethirds API
	</div>

	<div class="flex flex-1 flex-col justify-center px-10">
		<div class="mb-5 text-xl uppercase tracking-widest text-[#6B7280]">{api.category}</div>
	</div>
</div>