<script lang="ts">
  import { page } from "$app/state";
  import { tKey } from "$lib/i18n/mod";

  interface Props {
    t: (key: string, params?: Record<string, string | number>) => string;
  }
  let { t }: Props = $props();

  function titleize(slug: string) {
    return slug
      .replace(/[-_]+/g, " ")
      .split(" ")
      .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
      .join(" ");
  }

  const LABEL_MAP: Record<string, string> = {
    dashboard: tKey("Dashboard"),
    invoices: tKey("Invoices"),
    products: tKey("Products"),
    customers: tKey("Customers"),
    users: tKey("Users"),
    templates: tKey("Templates"),
    settings: tKey("Settings"),
    new: tKey("New"),
    edit: tKey("Edit"),
    html: tKey("HTML"),
    pdf: tKey("PDF"),
  };

  let segments = $derived(
    page.url.pathname
      .replace(/(^\/+|\/+?$)/g, "")
      .split("/")
      .filter(Boolean),
  );

  let crumbs = $derived(
    segments.map((seg, idx) => {
      let hrefAcc = "/" + segments.slice(0, idx + 1).join("/");
      let isLast = idx === segments.length - 1;
      let english = LABEL_MAP[seg] || titleize(seg);
      return {
        label: t(english),
        href: isLast ? undefined : hrefAcc,
      };
    }),
  );
</script>

{#if segments.length >= 2}
  <div class="breadcrumbs mb-4 text-sm">
    <ul>
      {#each crumbs as c (c.href ?? c.label)}
        <li>
          {#if c.href}
            <a href={c.href}>{c.label}</a>
          {:else}
            <span class="font-medium">{c.label}</span>
          {/if}
        </li>
      {/each}
    </ul>
  </div>
{/if}
