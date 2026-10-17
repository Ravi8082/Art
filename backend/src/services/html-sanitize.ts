const allowedTags = new Set(['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'a', 'ul', 'ol', 'li', 'h2', 'h3', 'span', 'div'])
const safeUrl = /^https?:\/\/[^\s<>"']+|^mailto:[^\s<>"'@]+@[^\s<>"'@]+$/i

// Strips disallowed tags and every attribute except safe hrefs; admin-authored rich text only.
export function sanitizeHtml(input: string) {
  let html = input
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style|iframe|object|embed|form|input|button|link|meta|base)\b[\s\S]*?(<\/\1\s*>|$)/gi, '')
    .replace(/<\s*(\/?)\s*([a-zA-Z][a-zA-Z0-9]*)[^>]*?>/g, (_match, closing: string, rawTag: string) => {
      const tag = rawTag.toLowerCase()
      if (!allowedTags.has(tag)) return ''
      if (tag === 'a' && !closing) {
        const href = /\shref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(_match)
        const url = (href?.[1] ?? href?.[2] ?? href?.[3] ?? '').replace(/&amp;/gi, '&').trim()
        return safeUrl.test(url) ? `<a href="${url.replace(/"/g, '&quot;')}" rel="noopener noreferrer nofollow" target="_blank">` : '<a>'
      }
      return closing ? `</${tag}>` : `<${tag}>`
    })
  html = html.replace(/<a>(?![\s\S]*<\/a>)/gi, '')
  return html.trim().slice(0, 20000)
}
