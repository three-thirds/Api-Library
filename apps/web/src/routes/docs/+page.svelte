<script lang="ts">
 import * as Sidebar from "$lib/components/ui/sidebar/index.js";
 import AppSidebar from "$lib/components/docs-sidebar.svelte";
 
 let { children } = $props();
</script>
 
<Sidebar.Provider>
 <AppSidebar />
 <main>
  {@render children?.()}
 </main>
</Sidebar.Provider>