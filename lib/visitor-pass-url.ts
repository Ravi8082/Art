export function visitorPassUrl(token: string, currentOrigin: string) {
  const publicOrigin = process.env.NEXT_PUBLIC_SITE_URL || currentOrigin
  return new URL(`/visitor/pass/${encodeURIComponent(token)}`, publicOrigin).toString()
}
