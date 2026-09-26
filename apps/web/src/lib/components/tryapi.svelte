<script lang="ts">
 import * as Dialog from "$lib/components/ui/dialog/index.js";
 import { Button } from "$lib/components/ui/button/index.js";
 import { Input } from "$lib/components/ui/input/index.js";
 
 let { api}: {api:any} = $props();
 let open = $state(false);
 let values = $state<Record<string, string>>(
    Object.fromEntries((api.params?? []).map((param: any) => [param.name, param.example ?? '']))
 );

 let loading = $state(false);
 let responseText = $state('');
 let status = $state<number | null>(null);

    async function send() {
        loading = true;
        responseText: '';
        status: null;
    }

    let path = api.route;

</script>

<Dialog.Root>
 <Dialog.Trigger>Open</Dialog.Trigger>
 <Dialog.Content>
  <Dialog.Header>
   <Dialog.Title>Are you sure absolutely sure?</Dialog.Title>
   <Dialog.Description>
    This action cannot be undone. This will permanently delete your account
    and remove your data from our servers.
   </Dialog.Description>
  </Dialog.Header>
 </Dialog.Content>
</Dialog.Root>
