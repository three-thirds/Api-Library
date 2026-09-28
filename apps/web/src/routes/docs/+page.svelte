<script lang="ts">
  import * as Sidebar from "$lib/components/ui/sidebar/index.js";
  import AppSidebar from "$lib/components/docs-sidebar.svelte";
  import ApiCard from "$lib/components/apicard.svelte";

  let { children } = $props();
</script>

<Sidebar.Provider class="h-full w-full flex overflow-hidden">
  <!-- Pinned Left Sidebar: Fits exactly between Header and Footer -->
  <AppSidebar />

  <!-- Scrollable Main Cards Pane -->
  <main class="flex-1 h-full overflow-y-auto p-6">
    <div class="max-w-4xl mx-auto space-y-6 pb-12">
      <ApiCard />
      {@render children?.()}
    </div>
  </main>
</Sidebar.Provider>
