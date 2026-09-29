<script lang="ts">
  import { goto } from '$app/navigation';
  import { authClient } from '$lib/auth-client';

  let mode = $state<'signin' | 'signup'>('signin');
  let name = $state('');
  let email = $state('');
  let password = $state('');
  let error = $state('');
  let loading = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    loading = true;

    const { error: err } =
      mode === 'signup'
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

    loading = false;
    if (err) {
      error = err.message ?? 'Something went wrong';
      return;
    }
    await goto('/', { invalidateAll: true });
  }
</script>

<form onsubmit={submit}>
  <h1>{mode === 'signin' ? 'Log in' : 'Create account'}</h1>

  {#if mode === 'signup'}
    <input type="text" placeholder="Name" bind:value={name} required />
  {/if}
  <input type="email" placeholder="Email" bind:value={email} required />
  <input type="password" placeholder="Password" bind:value={password} minlength="8" required />

  {#if error}<p style="color: red">{error}</p>{/if}

  <button disabled={loading}>
    {mode === 'signin' ? 'Log in' : 'Sign up'}
  </button>

  <button type="button" onclick={() => (mode = mode === 'signin' ? 'signup' : 'signin')}>
    {mode === 'signin' ? 'Need an account?' : 'Already have one?'}
  </button>
</form>