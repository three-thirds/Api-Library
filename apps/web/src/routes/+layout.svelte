<script lang="ts">
  import favicon from '$lib/assets/favicon.svg';
  import '../app.css';
  import Header from '$lib/components/header.svelte';
  import Footer from '$lib/components/footer.svelte';

  let { children } = $props();
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="flex h-screen w-screen flex-col overflow-hidden bg-background text-foreground">
  <!-- Pinned Top Header -->
  <div class="shrink-0 border-b border-border">
    <Header />
  </div>

  <!-- Middle Work Area (Sidebar + Content fit exactly here) -->
  <div class="flex-1 min-h-0 overflow-hidden">
    {@render children()}
  </div>

  <!-- Pinned Bottom Footer (Always visible!) -->
  <div class="shrink-0 border-t border-border">
    <Footer />
  </div>
</div>
