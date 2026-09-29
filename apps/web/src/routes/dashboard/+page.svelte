<script lang="ts">
    import {goto} from "$app/navigation";
    import  {authClient} from "$lib/auth-client";
    let {data} = $props();
</script>

{data.user.name}

