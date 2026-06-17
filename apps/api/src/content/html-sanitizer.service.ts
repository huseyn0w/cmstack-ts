import { Injectable } from '@nestjs/common';
import sanitizeHtml from 'sanitize-html';

/**
 * Sanitizes rich-text HTML (produced by the Tiptap editor) before it is stored,
 * so stored content can be rendered without XSS risk. The allowlist covers the
 * formatting Tiptap emits; everything else — scripts, event handlers, unknown
 * tags/attributes, dangerous URL schemes — is stripped.
 */
@Injectable()
export class HtmlSanitizerService {
  private readonly options: sanitizeHtml.IOptions = {
    allowedTags: [
      'p',
      'br',
      'hr',
      'blockquote',
      'pre',
      'code',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'strong',
      'b',
      'em',
      'i',
      'u',
      's',
      'mark',
      'sub',
      'sup',
      'ul',
      'ol',
      'li',
      'a',
      'img',
      'figure',
      'figcaption',
      'table',
      'thead',
      'tbody',
      'tr',
      'th',
      'td',
      'span',
    ],
    allowedAttributes: {
      a: ['href', 'title', 'target', 'rel'],
      img: ['src', 'alt', 'title', 'width', 'height'],
      span: ['class'],
      code: ['class'],
      th: ['colspan', 'rowspan'],
      td: ['colspan', 'rowspan'],
    },
    // Only safe URL schemes. `data:` is intentionally NOT allowed (even on img),
    // since data:image/svg+xml can smuggle markup; blocks javascript:, etc.
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['http', 'https'] },
    // Restrict class names to the prefixes Tiptap/highlighting emit, so editors
    // cannot inject arbitrary layout/style classes.
    allowedClasses: {
      code: ['language-*', 'hljs', 'hljs-*'],
      span: ['hljs-*', 'token', 'token-*'],
    },
    // Force external links to be safe.
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer nofollow' }),
    },
  };

  sanitize(html: string): string {
    return sanitizeHtml(html, this.options);
  }
}
