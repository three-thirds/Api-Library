<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button/index.js";
  import { Input } from "$lib/components/ui/input/index.js";

  let { data } = $props();

  let newlyGeneratedKey = $state<string | null>(null);
  let generatingKey = $state(false);
  let keyCopied = $state(false);

  // Vault state
  let masterKeyInput = $state(""); // Key used to authenticate vault edits
  let provider = $state("openweather");
  let secretInput = $state("");
  let savingSecret = $state(false);
  let secretMessage = $state("");
  let configuredSecrets = $state<Record<string, string>>({});

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
      newlyGeneratedKey = json.master_key;
      masterKeyInput = json.master_key; // Auto-fill for immediate vault editing
    } catch (err) {
      console.error("Failed to generate key:", err);
    } finally {
      generatingKey = false;
    }
  }

  async function copyKey() {
    if (!newlyGeneratedKey) return;
    await navigator.clipboard.writeText(newlyGeneratedKey);
    keyCopied = true;
    setTimeout(() => (keyCopied = false), 2000);
  }

  async function saveSecret() {
    const activeKey = newlyGeneratedKey || masterKeyInput;
    if (!activeKey || !provider || !secretInput) return;

    savingSecret = true;
    secretMessage = "";

    try {
      const res = await fetch("/api/v1/keys/secrets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${activeKey}`,
        },
        body: JSON.stringify({ provider, secret: secretInput }),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        throw new Error(err.error ?? "Failed to save secret");
      }

      secretMessage = `Saved secret for '${provider}' successfully!`;
      secretInput = "";
      await fetchConfiguredSecrets(activeKey);
    } catch (err) {
      secretMessage = `Error: ${String(err)}`;
    } finally {
      savingSecret = false;
    }
  }

  async function fetchConfiguredSecrets(keyToUse?: string) {
    const activeKey = keyToUse || newlyGeneratedKey || masterKeyInput;
    if (!activeKey) return;

    try {
      const res = await fetch("/api/v1/keys/secrets", {
        headers: { Authorization: `Bearer ${activeKey}` },
      });
      if (res.ok) {
        const json = (await res.json()) as {
          configured_secrets: Record<string, string>;
        };
        configuredSecrets = json.configured_secrets ?? {};
      }
    } catch (err) {
      console.error("Failed to fetch secrets:", err);
    }
  }

  async function deleteSecret(targetProvider: string) {
    const activeKey = newlyGeneratedKey || masterKeyInput;
    if (!activeKey) return;

    try {
      const res = await fetch(
        `/api/v1/keys/secrets/${encodeURIComponent(targetProvider)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${activeKey}` },
        },
      );

      if (res.ok) {
        secretMessage = `Removed '${targetProvider}' from vault`;
        await fetchConfiguredSecrets(activeKey);
      }
    } catch (err) {
      console.error("Failed to delete secret: ", err);
    }
  }
</script>

<div
  class="h-full w-full overflow-y-auto bg-background text-foreground p-6 md:p-12"
>
  <div class="max-w-4xl mx-auto space-y-8">
    <!-- Header -->
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
        Sign out
      </Button>
    </div>

    <div
      class="rounded-xl border border-border bg-card p-6 shadow-sm space-y-4"
    >
      <div class="flex items-start justify-between gap-4">
        <div>
          <h2 class="text-lg font-semibold tracking-tight">Master API Key</h2>
          <p class="text-xs text-muted-foreground mt-1">
            Use this key in the <code
              class="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono"
              >Authorization: Bearer &lt;key&gt;</code
            > header for all gateway requests.
          </p>
        </div>
        <Button size="sm" onclick={generateKey} disabled={generatingKey}>
          {generatingKey ? "Generating..." : "Generate New Key"}
        </Button>
      </div>

      {#if newlyGeneratedKey}
        <div class="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
          <div
            class="flex items-center justify-between text-xs text-muted-foreground"
          >
            <span class="font-mono text-[11px] uppercase tracking-wider">
              Secret Key &mdash; Store securely (one-time display)
            </span>
            <Button
              size="sm"
              variant="ghost"
              class="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
              onclick={() => (newlyGeneratedKey = null)}
            >
              Dismiss
            </Button>
          </div>

          <div class="flex items-center gap-2">
            <input
              type="text"
              readonly
              value={newlyGeneratedKey}
              class="flex-1 h-9 rounded-md border border-border bg-background px-3 font-mono text-xs text-foreground select-all focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <Button
              size="sm"
              variant="secondary"
              onclick={copyKey}
              class="min-w-20"
            >
              {keyCopied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      {:else}
        <!-- Default State: Masked indicator -->
        <div
          class="flex items-center justify-between p-3 rounded-md border border-border bg-muted/20 text-xs"
        >
          <span class="text-muted-foreground">Active Key:</span>
          <code class="font-mono text-muted-foreground"
            >al_live_••••••••••••••••••••••••••••••••</code
          >
        </div>
      {/if}
    </div>

    <div
      class="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6"
    >
      <div>
        <h2 class="text-lg font-semibold tracking-tight">
          Upstream Secret Vault
        </h2>
        <p class="text-xs text-muted-foreground mt-1">
          Store third-party API keys in your encrypted edge vault.
        </p>
      </div>

      <!-- Form -->
      <div class="space-y-4">
        <!-- If key was not just generated, allow user to input their master key to unlock edits -->
        {#if !newlyGeneratedKey}
          <div class="space-y-1">
            <label
              for="masterKeyInput"
              class="text-xs font-medium text-foreground"
              >Your Master API Key</label
            >
            <div class="flex gap-2">
              <Input
                id="masterKeyInput"
                type="password"
                placeholder="al_live_..."
                bind:value={masterKeyInput}
                class="h-9 text-xs font-mono"
              />
              <Button
                size="sm"
                variant="secondary"
                onclick={() => fetchConfiguredSecrets(masterKeyInput)}
                disabled={!masterKeyInput}
              >
                Unlock Vault
              </Button>
            </div>
          </div>
        {/if}

        <div class="flex flex-col sm:flex-row items-end gap-2 pt-2">
          <div class="w-full sm:w-1/3 space-y-1">
            <label for="provider" class="text-xs font-medium">Provider</label>
            <Input
              id="provider"
              placeholder="openweather"
              bind:value={provider}
              class="h-9 text-xs font-mono"
            />
          </div>

          <div class="w-full sm:flex-1 space-y-1">
            <label for="secret" class="text-xs font-medium">Secret Token</label>
            <Input
              id="secret"
              type="password"
              placeholder="Paste API token..."
              bind:value={secretInput}
              class="h-9 text-xs font-mono"
            />
          </div>

          <Button
            size="sm"
            onclick={saveSecret}
            disabled={savingSecret ||
              !secretInput ||
              (!newlyGeneratedKey && !masterKeyInput)}
            class="min-w-28 justify-center"
          >
            {savingSecret ? "Saving..." : "Save to Vault"}
          </Button>
        </div>

        {#if secretMessage}
          <p
            class="text-xs font-medium {secretMessage.startsWith('Error')
              ? 'text-destructive'
              : 'text-green-500'}"
          >
            {secretMessage}
          </p>
        {/if}
      </div>

      <!-- Active Credentials List -->
      {#if Object.keys(configuredSecrets).length > 0}
        <div class="space-y-2 pt-4 border-t border-border">
          <h4
            class="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Active Vault Credentials
          </h4>
          <div
            class="divide-y divide-border rounded-md border border-border overflow-hidden"
          >
            {#each Object.entries(configuredSecrets) as [prov, masked]}
              <div
                class="flex items-center justify-between p-3 bg-muted/20 text-xs"
              >
                <div class="flex items-center gap-2">
                  <span class="font-mono font-medium uppercase text-foreground"
                    >{prov}</span
                  >
                  <code
                    class="bg-muted px-2 py-0.5 rounded font-mono text-muted-foreground"
                    >{masked}</code
                  >
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  class="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                  onclick={() => deleteSecret(prov)}
                >
                  Remove
                </Button>
              </div>
            {/each}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
