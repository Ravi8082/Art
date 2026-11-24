export function sessionVersionMatches(tokenVersion: unknown, currentVersion: unknown): boolean {
  const version = tokenVersion ?? 0
  const current = Number(currentVersion)
  return typeof version === 'number'
    && Number.isSafeInteger(version)
    && version >= 0
    && currentVersion !== null
    && currentVersion !== undefined
    && Number.isSafeInteger(current)
    && current >= 0
    && current === version
}
