<script lang="ts">
    import { page } from "$app/stores";
    import { Button } from "$lib/components/ui/button/index.js";

    const links = [
        {label: "Home", href: "/"},
        {label: "Docs", href: "/docs"},
        {label: "Contribution", href: "/contribution"}
    ]

    let active = $state(home)
</script>

<header class="flex items-center gap-2 border-b bg-background/50 p-2">
    {#each links as link}
        <Button variant="link">{link}</Button>
    {/each}
</header>
