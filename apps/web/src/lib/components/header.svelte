<script lang="ts">
    import { page } from "$app/state";
    import { Button } from "$lib/components/ui/button/index.js";

    const links = [
        {label: "Home", href: "/"},
        {label: "Docs", href: "/docs"},
        {label: "Contribution", href: "/contribution"}
    ]

</script>

<header class="flex items-center gap-2 border-b bg-background/50 p-2">
    {#each links as link}
        <Button variant={page.url.pathname === link.href ? "secondary" : "ghost"} href={link.href}>{link.label}</Button>
    {/each}
</header>
