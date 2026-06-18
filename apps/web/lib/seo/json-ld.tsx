/**
 * Renders a JSON-LD <script>. The payload comes from admin-editable fields, so
 * `<` is escaped to `<` to prevent a `</script>` breakout (stored XSS) —
 * the JSON stays valid and search engines/AI crawlers parse it the same.
 */
export function JsonLd({ data }: { data: unknown }) {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  return (
    // biome-ignore lint/security/noDangerouslySetInnerHtml: structured data, `<` escaped above.
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: json }} />
  );
}
