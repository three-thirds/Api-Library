<script lang="ts">
    import apis from "$lib/apis.json";
</script>

<div class="flex flex-col gap-4">
    {#each apis as api (api.id)}
        <div class="flex flex-row gap-2 rounded-lg border bg-background p-4 justify-between">
            <div>
                <h1 class="text-2xl font-semibold">{api.name}</h1>
                <div class="border border-t border-dotted"></div>
                <h3 class="text-sm text-muted-foreground mb-3">{api.description}</h3>

                <p class="text-lg">Path Parameters</p>
                <hr>
                {#each api.params as param (param.name)}
                    <div class="flex items-center gap-2">
                        <p class="text-base text-foreground">{param.name}</p>
                        <p class="text-xs text-muted-foreground">{param.type}</p>
                        {#if param.required}
                            <p class="text-xs text-[#d98014]">Required</p>
                        {/if}
                    </div>
                    <p class="text-sm">{param.description}</p>
                    <p class="text-sm">Example: {param.example}</p>
                    <hr>
                {/each}

                {#each api.errors as errors (errors.code)}
                <div class="flex items-center gap-2">
                    <p class="text-lg">{errors.status}</p>
                    <p class="text-sm">{errors.code}</p>
                    <!-- <p class="text-sm">{errors.message}</p> -->
                    <hr>
                </div>
                {/each}
                
            </div>
            <!-- <div class="flex flex-row gap-2 items-center">
                hi
            </div> -->
        </div>
    {/each}

</div>