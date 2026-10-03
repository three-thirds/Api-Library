<script lang="ts">
  import { goto } from "$app/navigation";
  import { authClient } from "$lib/auth-client";
  import { Button } from "$lib/components/ui/button";
  import { Input } from "$lib/components/ui/input/index.js";

  let mode = $state<"signin" | "signup">("signin");
  let name = $state("");
  let email = $state("");
  let password = $state("");
  let error = $state("");
  let loading = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = "";
    loading = true;

    const { error: err } =
      mode === "signup"
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

    loading = false;
    if (err) {
      error = err.message ?? "Something went wrong";
      return;
    }
    await goto("/dashboard", { invalidateAll: true });
  }
</script>

<div class="flex min-h-[calc(100vh-10rem)] items-center justify-center p-4">
  <div class="w-full max-w-sm space-y-6">
    <div
      class="rounded-xl border border-border bg-card p-6 shadow-sm text-card-foreground"
    >
      <div class="space-y-1.5 text-center mb-6">
        <h1 class="text-2xl font-bold tracking-tight">
          {mode === "signin" ? "Welcome Back" : "Create a New Account"}
        </h1>
        <p class="text-xs text-card-foreground">
          {mode === "signin"
            ? "Enter your credentials!!"
            : "Get started with Api-Library quick quick!!! agagaga"}
        </p>
      </div>

      <form onsubmit={submit} class="space-y-4">
        {#if error}
          <div
            class="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive font-medium"
          >
            {error}
          </div>
        {/if}

        {#if mode === "signup"}
          <div class="space-y-1.5">
            <label for="name" class="text-xs font-medium text-foreground"
              >Name
            </label>
            <Input
              id="name"
              type="text"
              placeholder="Your Name"
              bind:value={name}
              required
            />
          </div>
        {/if}

        <div class="space-y-1.5">
          <label for="email" class="text-xs font-medium text-foreground"
            >Email
          </label>
          <Input
            id="email"
            type="email"
            placeholder="me@threethirds.dev"
            bind:value={email}
            required
          />
        </div>

        <div class="space-y-1.5">
          <label for="password" class="text-xs font-medium text-foreground"
            >Password
          </label>
          <Input
            id="password"
            type="password"
            placeholder="*********"
            bind:value={password}
            minlength={8}
            required
          />
        </div>

        <Button type="submit" disabled={loading} class="w-full mt-2">
          {#if loading}
            Processing...
          {:else}
            {mode === "signin" ? "Sign in" : "Create Account"}
          {/if}
        </Button>
      </form>

      <div
        class="mt-6 text-center text-xs text-muted-foreground border-t border-border pt-4"
      >
        <span
          >{mode === "signin"
            ? "Don't have an account?"
            : "Already have an account?"}</span
        >
        <!-- svelte-ignore a11y_consider_explicit_label -->
        <button
          type="button"
          onclick={() => {
            mode = mode === "signin" ? "signup" : "signin";
          }}
          class="font-semibold text-foreground underline underline-offset-4 hover:text-primary ml-1"
        >
          {mode === "signin" ? "Sign up" : "Sign in"}
        </button>
      </div>
    </div>
  </div>
</div>
