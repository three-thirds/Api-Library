<script lang="ts">
    import { page } from "$app/state";
    import { Button } from "$lib/components/ui/button/index.js";

    const links = [
        {label: "Home", href: "/"},
        {label: "Docs", href: "/docs"},
        {label: "Contribution", href: "/contribution"}
    ]

    import * as Avatar from "$lib/components/ui/avatar/index.js";
    import * as DropdownMenu from "$lib/components/ui/dropdown-menu/index.js"
</script>

<header class="flex items-center gap-2 border-b bg-background/50 p-2 justify-between mr-2">
    <div>
    {#each links as link}
        <Button variant={page.url.pathname === link.href ? "secondary" : "ghost"} href={link.href}>{link.label}</Button>
    {/each}
    </div>

    <DropdownMenu.Root>
        <DropdownMenu.Trigger>
        <!-- trigger -->
            <Avatar.Root class="hover:border-2 cursor-pointer border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <Avatar.Image src="https://github.com/shadcn.png" alt="@shadcn" />
                <Avatar.Fallback>CN</Avatar.Fallback>
            </Avatar.Root>

            <DropdownMenu.Content align="end" class="flex flex-col gap-2">
                <DropdownMenu.Group>
                    <DropdownMenu.Label>Account</DropdownMenu.Label>
                    <DropdownMenu.Separator />
                    <Button variant="outline">Login/Signup</Button>
                </DropdownMenu.Group>
            </DropdownMenu.Content>
        </DropdownMenu.Trigger>
    </DropdownMenu.Root>
</header>
