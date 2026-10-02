<script lang="ts">
	import apis from "$lib/apis.json";
	import ApiCard from "$lib/components/apicard.svelte";
	import type { ApiEntry } from "$lib/types";

	const list = apis as ApiEntry[];
</script>

<div class="flex flex-col gap-4">
	{#each list as api (api.id)}
		<ApiCard {api} />
	{/each}
</div>
