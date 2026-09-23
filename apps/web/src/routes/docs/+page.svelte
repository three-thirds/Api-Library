<script lang="ts">
 import * as Sidebar from "$lib/components/ui/sidebar/index.js";
 import AppSidebar from "$lib/components/docs-sidebar.svelte";
 import ApiCard from "$lib/components/apicard.svelte";

 let { children } = $props();
</script>
 
<Sidebar.Provider>
 <AppSidebar />
 <main>
  {@render children?.()}
 </main>
</Sidebar.Provider>

<ApiCard></ApiCard>