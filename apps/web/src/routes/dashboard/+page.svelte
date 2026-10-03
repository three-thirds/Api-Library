<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client.js";
  import { Button } from "$lib/components/ui/button/index.js";
  import Input from "$lib/components/ui/input/input.svelte";

  let { data } = $props();

  //Vault secrets stuff
  let provider = $state("openweather");
  let secretInput = $state("");
  let savingSecret = $state(false);
  let secretMessage = $state("");
  let configuredSecrets = $state<Record<string, string>>({});

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

  async function saveSecret() {
    if (!masterKey || !provider || !secretInput) return;
    savingSecret = true;
    secretMessage = "";

    try {
      const res = await fetch("/api/v1/keys/secrets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${masterKey}`,
        },
        body: JSON.stringify({ provider, secret: secretInput }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to save secret");
      }

      secretMessage = `Successfully saved Secret for ${provider}`;
      secretInput = "";

      await fetchConfiguredSecrets();
    } catch (err) {
      secretMessage = `Error: ${String(err)}`;
    } finally {
      savingSecret = false;
    }
  }

  async function fetchConfiguredSecrets() {
    if (!masterKey) return;
    try {
      const res = await fetch("/api/v1/keys/secrets", {
        headers: { Authorization: `Bearer ${masterKey}` },
      });

      if (res.ok) {
        const json = (await res.json()) as {
          configured_secrets: Record<string, string>;
        };
        configuredSecrets = json.configured_secrets ?? {};
      }
    } catch (err) {
      console.error("Failed to fetch secrets: ", err);
    }
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

    <!-- Secrets Vault section -->
    <div
      class="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
    >
      <div>
        <h2 class="text-lg font-semibold">
          Upstream Vault Secret(It's a real secret BTW)
        </h2>
        <p class="text-xs text-muted-foreground">
          Store your third-party API keys here.
        </p>
      </div>
      {#if !masterKey}
        <p>Generate a Master Key above first :p</p>
      {:else}
        <div class="flex flex-col sm:flex-row items-end gap-2">
          <div class="w-full sm:flex-1 space-y-1">
            <label for="provider" class="text-xs font-medium">Provider</label>
            <Input
              id="provider"
              placeholder="openweather"
              bind:value={provider}
              class="h-8 text-xs font-mono"
            />
          </div>
          <!-- Secret token input -->
          <div class="w-full sm:flex-1 space-y-1">
            <label for="secret" class="text-xs font-medium">Secret Token</label>
            <Input
              id="secret"
              type="password"
              placeholder="Paste API token..."
              bind:value={secretInput}
              class="h-8 text-xs font-mono"
            />
          </div>

          <Button
            size="sm"
            onclick={saveSecret}
            disabled={savingSecret || !secretInput}
            class="min-w-28 justify-center"
          >
            {savingSecret ? "Saving..." : "Save to Vault"}
          </Button>
        </div>
        {#if secretMessage}
          <p class="text-xs font-medium text-green-500">{secretMessage}</p>
        {/if}

        {#if Object.keys(configuredSecrets).length > 0}
          <div class="space-y-2 pt-4 border-t border-border">
            <h4
              class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
            >
              Active Keys
            </h4>

            <div
              class="divide-y divide-border rounded-md border border-border overflow-hidden"
            >
              {#each Object.entries(configuredSecrets) as [prov, masked]}
                <div
                  class="flex items-center justify-between p-3 bg-muted/20 text-xs"
                >
                  <span class="font-mono font-medium uppercase text-foreground"
                    >{prov}</span
                  >
                  <code
                    class="bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground"
                    >{masked}</code
                  >
                </div>
              {/each}
            </div>
          </div>
        {/if}
      {/if}
    </div>
  </div>
</div>
