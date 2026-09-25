<script lang="ts">
    import {marked} from "marked";
    import raw from "$lib/assets/contrib.md?raw";

    const html = marked.parse(raw);
</script>

<article class="prose prose-invert mx-auto max-w-3xl p-6">
  {@html html}
</article>