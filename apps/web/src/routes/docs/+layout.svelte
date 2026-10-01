<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import AppSidebar from "$lib/components/docs-sidebar.svelte";

	let { children } = $props();
</script>

<Sidebar.Provider class="h-full w-full flex overflow-hidden">
	<AppSidebar />

	<main class="flex-1 h-full overflow-y-auto p-6">
		<div class="mb-4 md:hidden">
			<Sidebar.Trigger />
		</div>
		<div class="max-w-4xl mx-auto space-y-6 pb-12">
			{@render children()}
		</div>
	</main>
</Sidebar.Provider>
