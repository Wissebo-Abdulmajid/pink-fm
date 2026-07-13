import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { deflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value
  for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  return crc >>> 0
})

const crc32 = (buffer) => {
  let crc = 0xffffffff
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

const chunk = (type, data) => {
  const typeBuffer = Buffer.from(type)
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])))
  return Buffer.concat([length, typeBuffer, data, checksum])
}

const hex = (value) => [
  Number.parseInt(value.slice(1, 3), 16),
  Number.parseInt(value.slice(3, 5), 16),
  Number.parseInt(value.slice(5, 7), 16),
  255,
]

const roundedRectContains = (x, y, left, top, right, bottom, radius) => {
  if (x >= left + radius && x <= right - radius && y >= top && y <= bottom) return true
  if (y >= top + radius && y <= bottom - radius && x >= left && x <= right) return true
  const centres = [
    [left + radius, top + radius],
    [right - radius, top + radius],
    [left + radius, bottom - radius],
    [right - radius, bottom - radius],
  ]
  return centres.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2)
}

const colourAt = (x, y, size, maskable) => {
  const p = (value) => value * size
  const background = maskable ? hex('#d94f83') : hex('#fff7fa')
  const distanceFromCentre = Math.hypot(x - p(0.5), y - p(0.5))
  if (!maskable && distanceFromCentre > p(0.7)) return [0, 0, 0, 0]
  let colour = background
  if (roundedRectContains(x, y, p(0.135), p(0.27), p(0.865), p(0.82), p(0.13))) colour = hex('#d94f83')
  if (roundedRectContains(x, y, p(0.2), p(0.35), p(0.8), p(0.51), p(0.045))) colour = hex('#4a2036')
  if (x >= p(0.25) && x <= p(0.75) && Math.abs(y - p(0.43)) <= Math.max(1, p(0.007))) colour = hex('#ffe9c5')
  if (Math.abs(x - p(0.54)) <= Math.max(1, p(0.007)) && y >= p(0.37) && y <= p(0.49)) colour = hex('#ff7188')
  const speakerDistance = Math.hypot(x - p(0.335), y - p(0.665))
  if (speakerDistance <= p(0.115)) colour = hex('#e7b8c9')
  if (speakerDistance <= p(0.052)) colour = hex('#a8275c')
  const dialDistance = Math.hypot(x - p(0.67), y - p(0.665))
  if (dialDistance <= p(0.1)) colour = hex('#ef9eba')
  if (dialDistance <= p(0.078) && Math.abs(x - p(0.67)) <= p(0.009) && y < p(0.665)) colour = hex('#4a2036')
  const handleOuter = roundedRectContains(x, y, p(0.26), p(0.16), p(0.74), p(0.34), p(0.08))
  const handleInner = roundedRectContains(x, y, p(0.31), p(0.205), p(0.69), p(0.34), p(0.05))
  if (handleOuter && !handleInner) colour = hex('#4a2036')
  return colour
}

const createPng = (size, maskable = false) => {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y += 1) {
    raw[y * stride] = 0
    for (let x = 0; x < size; x += 1) {
      const colour = colourAt(x, y, size, maskable)
      const offset = y * stride + 1 + x * 4
      raw[offset] = colour[0]
      raw[offset + 1] = colour[1]
      raw[offset + 2] = colour[2]
      raw[offset + 3] = colour[3]
    }
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const output = resolve(root, 'public', 'icons')
writeFileSync(resolve(output, 'pink-fm-192.png'), createPng(192))
writeFileSync(resolve(output, 'pink-fm-512.png'), createPng(512))
writeFileSync(resolve(output, 'pink-fm-maskable-512.png'), createPng(512, true))
console.log('Generated Pink FM icons: 192px, 512px, and maskable 512px.')
