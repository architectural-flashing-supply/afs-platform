import sanitizeHtml from 'sanitize-html';

/**
 * Email HTML is hostile input. This produces markup that is safe to put in the View Source pane:
 * no scripts, forms, iframes, event handlers or style/CSS, links limited to http(s)/mailto, and remote images
 * BLOCKED by default (they are tracking pixels) with an explicit opt-in. The result is additionally rendered
 * inside a sandboxed iframe by the UI, so this is defence in depth, not the only layer.
 */
export function sanitizeEmailHtml(html: string, opts: { loadImages?: boolean } = {}): string {
  return sanitizeHtml(html, {
    allowedTags: [
      'a', 'b', 'i', 'em', 'strong', 'u', 's', 'p', 'br', 'hr', 'div', 'span', 'blockquote', 'pre', 'code',
      'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th',
      'sub', 'sup', ...(opts.loadImages ? ['img'] : []),
    ],
    allowedAttributes: {
      a: ['href', 'title', 'rel', 'target'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
      ...(opts.loadImages ? { img: ['src', 'alt', 'width', 'height'] } : {}),
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowedSchemesByTag: { img: ['https'] },
    allowProtocolRelative: false,
    disallowedTagsMode: 'discard',
    transformTags: {
      a: (tagName, attribs) => ({ tagName, attribs: { ...attribs, rel: 'noopener noreferrer nofollow', target: '_blank' } }),
    },
    // Drop the CONTENT of dangerous containers, not just the tags.
    nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript', 'iframe', 'object', 'embed', 'form'],
  });
}
