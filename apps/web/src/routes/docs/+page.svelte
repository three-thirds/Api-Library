<script lang="ts">
 import * as Sidebar from "$lib/components/ui/sidebar/index.js";
 import AppSidebar from "$lib/components/docs-sidebar.svelte";
 import ApiCard from "$lib/components/apicard.svelte";

 let { children } = $props();
</script>
 
<Sidebar.Provider>
    <AppSidebar />
    <main class="flex-1 overflow-y-auto p-6">
        <ApiCard />
        {@render children?.()}
    </main>
</Sidebar.Provider>
