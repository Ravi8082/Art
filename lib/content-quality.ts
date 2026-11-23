const explicitPlaceholder = /\b(?:demo|placeholder|sample text|lorem ipsum)\b/i
const standalonePlaceholder = /^(?:abc|sample|test|xyz)$/i
const repeatedCharacter = /^(.)\1{5,}$/i

export function isPlaceholderContent(...values: Array<string | null | undefined>) {
  return values.some((value) => {
    const text = value?.trim() ?? ''
    return explicitPlaceholder.test(text) || standalonePlaceholder.test(text) || repeatedCharacter.test(text)
  })
}
