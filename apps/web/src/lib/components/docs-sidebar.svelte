<script lang="ts">
	import { page } from "$app/state";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import apis from "$lib/apis.json";
	import type { ApiEntry } from "$lib/types";

	const list = apis satisfies (ApiEntry & { category: string })[];

	let search = $state("");

	const filtered = $derived(
		list.filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
	);

	const grouped = $derived(
		filtered.reduce(
			(acc, api) => {
				(acc[api.category] ??= []).push(api);
				return acc;
			},
			{} as Record<string, typeof filtered>,
		),
	);
</script>

<Sidebar.Root collapsible="none" class="h-full max-h-full flex flex-col bg-background/90 border-r border-dotted">
	<Sidebar.Header>
		<Sidebar.Input bind:value={search} placeholder="Search APIs..." />
	</Sidebar.Header>

	<Sidebar.Content class="flex-1 min-h-0 overflow-y-auto pb-12">
		{#each Object.entries(grouped) as [category, apis]}
			<Sidebar.Group>
				<Sidebar.GroupLabel>{category}</Sidebar.GroupLabel>
				<Sidebar.GroupContent>
					<Sidebar.Menu>
						{#each apis as api (api.id)}
							<Sidebar.MenuItem>
								<Sidebar.MenuButton isActive={page.url.pathname === `/docs/${api.id}`}>
									{#snippet child({ props })}
										<a href={`/docs/${api.id}`} class="w-full text-left" {...props}>
											{api.name}
										</a>
									{/snippet}
								</Sidebar.MenuButton>
							</Sidebar.MenuItem>
						{/each}
					</Sidebar.Menu>
				</Sidebar.GroupContent>
			</Sidebar.Group>
		{/each}
		<div class="h-24 shrink-0" aria-hidden="true"></div>
	</Sidebar.Content>
</Sidebar.Root>
