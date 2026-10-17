export const supportedMediaTypes = new Map<string, 'IMAGE' | 'VIDEO'>([
  ['image/jpeg', 'IMAGE'],
  ['image/png', 'IMAGE'],
  ['image/webp', 'IMAGE'],
  ['image/gif', 'IMAGE'],
  ['video/mp4', 'VIDEO'],
  ['video/webm', 'VIDEO'],
  ['video/quicktime', 'VIDEO'],
])

export function hasValidMediaSignature(contentType: string, data: Buffer) {
  switch (contentType) {
    case 'image/jpeg':
      return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff
    case 'image/png':
      return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    case 'image/webp':
      return data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP'
    case 'image/gif':
      return data.toString('ascii', 0, 3) === 'GIF'
    case 'video/mp4':
    case 'video/quicktime':
      return data.length >= 12 && data.toString('ascii', 4, 8) === 'ftyp'
    case 'video/webm':
      return data.length >= 4 && data.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
    default:
      return false
  }
}
