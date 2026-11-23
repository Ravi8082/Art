export function formatArtistName(name: string) {
  return name.trim().replace(/(^|\s)(\S)/g, (_match, space: string, initial: string) => `${space}${initial.toLocaleUpperCase()}`)
}
