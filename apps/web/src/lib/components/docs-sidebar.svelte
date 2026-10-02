<script lang="ts">
	import { page } from "$app/state";
	import * as Sheet from "$lib/components/ui/sheet/index.js";
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import { useSidebar } from "$lib/components/ui/sidebar/index.js";
	import apis from "$lib/apis.json";
	import type { ApiEntry } from "$lib/types";

	const sidebar = useSidebar();
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

	function closeMobile() {
		sidebar.setOpenMobile(false);
	}
</script>

{#snippet nav()}
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
										<a
											href={`/docs/${api.id}`}
											class="w-full text-left"
											{...props}
											onclick={(e) => {
												props.onclick?.(e);
												closeMobile();
											}}
										>
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
{/snippet}

<!-- Desktop: stays a side column between header and footer -->
<div
	class="hidden md:flex h-full max-h-full w-(--sidebar-width) shrink-0 flex-col bg-background/90 border-r border-dotted"
>
	{@render nav()}
</div>

<!-- Mobile: sheet over the page -->
<Sheet.Root bind:open={() => sidebar.openMobile, (v) => sidebar.setOpenMobile(v)}>
	<Sheet.Content
		side="left"
		class="w-(--sidebar-width) bg-background p-0 text-sidebar-foreground [&>button]:hidden"
	>
		<Sheet.Header class="sr-only">
			<Sheet.Title>APIs</Sheet.Title>
			<Sheet.Description>Browse the API list.</Sheet.Description>
		</Sheet.Header>
		<div class="flex h-full w-full flex-col">
			{@render nav()}
		</div>
	</Sheet.Content>
</Sheet.Root>
