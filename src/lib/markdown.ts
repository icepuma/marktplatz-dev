import { Marked } from "marked";

// Renders third-party Markdown (a skill's SKILL.md) into our pages without trusting it: raw HTML is shown as text,
// links survive only as http(s), mailto, anchors or relative paths (resolved against `base`, the pinned copy on
// GitHub), and images become plain links, so a skill cannot inject markup or make our pages load anything.
// Headings move down two levels (a SKILL.md h1 becomes an h3), so they sit under the page's own h1 and h2.

const escape = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function safeHref(href: string, base: string): string | null {
  const trimmed = href.trim();
  if (/^(https?:|mailto:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("#")) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) return null; // javascript:, data:, protocol-relative…
  try {
    return new URL(trimmed, base.endsWith("/") ? base : `${base}/`).href;
  } catch {
    return null;
  }
}

export function renderMarkdown(markdown: string, base: string): string {
  const marked = new Marked({ gfm: true });
  marked.use({
    renderer: {
      html({ text }) {
        return escape(text);
      },
      heading({ tokens, depth }) {
        const level = Math.min(depth + 2, 6);
        return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
      },
      link({ href, title, tokens }) {
        const label = this.parser.parseInline(tokens);
        const url = safeHref(href, base);
        if (!url) return label;
        return `<a href="${escape(url)}"${title ? ` title="${escape(title)}"` : ""} rel="nofollow noopener">${label}</a>`;
      },
      image({ href, text }) {
        const url = safeHref(href, base);
        const label = escape(text || href);
        return url ? `<a href="${escape(url)}" rel="nofollow noopener">[image: ${label}]</a>` : `[image: ${label}]`;
      },
    },
  });
  return marked.parse(markdown, { async: false }) as string;
}
