<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client.js";
  import { Button } from "$lib/components/ui/button/index.js";

  let { data } = $props();

  let masterKey = $state("");
  let generatingKey = $state(false);
  let keyCopied = $state(false);

  async function handleSignOut() {
    await authClient.signOut();
    await goto("/login", { invalidateAll: true });
  }

  async function generateKey() {
    generatingKey = true;
    try {
      const res = await fetch("/api/v1/keys/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.user.name }),
      });

      if (!res.ok) throw new Error("Server rejected key creation");

      const json = (await res.json()) as { master_key: string };
      masterKey = json.master_key;
    } catch (err) {
      console.error("Failed to generate key: ", err);
    } finally {
      generatingKey = false;
    }
  }

  async function copyKey() {
    if (!masterKey) return;
    await navigator.clipboard.writeText(masterKey);
    keyCopied = true;
    setTimeout(() => (keyCopied = false), 2000);
  }
</script>

<div class="min-h-screen bg-background text-foreground p-6 md:p-12">
  <div class="max-w-4xl mx-auto space-y-8">
    <div class="flex items-center justify-between border-b border-border pb-6">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Developer Dashboard</h1>
        <p class="text-sm text-muted-foreground mt-1">
          Logged in as <span class="font-medium text-foreground"
            >{data.user.name}</span
          >
          ({data.user.email})
        </p>
      </div>
      <Button variant="outline" size="sm" onclick={handleSignOut}>
        Sign Out</Button
      >
    </div>

    <div
      class="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
    >
      <div>
        <h2 class="text-lg font-semibold tracking-tight">Master API Key</h2>
        <p class="text-xs text-muted-foreground mt-1">
          Use this key in the <code
            class="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono"
            >Authorization: Bearer &lt;key&gt;</code
          > header to access all authenticated gateway endpoints.
        </p>
      </div>

      {#if !masterKey}
        <Button size="sm" onclick={generateKey} disabled={generatingKey}>
          {#if generatingKey}
            Generating...
          {:else}
            Generate Master Key
          {/if}
        </Button>
      {:else}
        <div class="space-y-2">
          <div class="flex items-center gap-2">
            <input
              type="text"
              readonly
              value={masterKey}
              class="flex-1 h-9 rounded-md border border-border bg-muted/50 px-3 font-mono text-xs text-foreground select-all"
            />
            <Button size="sm" variant="secondary" onclick={copyKey}>
              {keyCopied ? "Copied!" : "Copy Key"}
            </Button>
          </div>
          <p class="text-[11px] text-amber-500 font-medium">
            ⚠️ Make sure to copy your key now. For your security, it will not be
            displayed again!
          </p>
        </div>
      {/if}
    </div>
  </div>
</div>
