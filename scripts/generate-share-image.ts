import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { PNG } from 'pngjs'

const width = 1200
const height = 630
const png = new PNG({ width, height })

const colours = {
  background: [255, 247, 250, 255],
  surface: [255, 253, 253, 255],
  pink: [217, 79, 131, 255],
  pinkStrong: [168, 39, 92, 255],
  blush: [239, 158, 186, 255],
  plum: [74, 32, 54, 255],
  gold: [199, 154, 85, 255],
} as const

const setPixel = (x: number, y: number, colour: readonly number[]) => {
  if (x < 0 || x >= width || y < 0 || y >= height) return
  const index = (Math.floor(y) * width + Math.floor(x)) * 4
  for (let channel = 0; channel < 4; channel += 1) png.data[index + channel] = colour[channel] ?? 255
}

const fill = (colour: readonly number[]) => {
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) setPixel(x, y, colour)
}

const roundedRect = (left: number, top: number, right: number, bottom: number, radius: number, colour: readonly number[]) => {
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const nearestX = Math.max(left + radius, Math.min(x, right - radius - 1))
      const nearestY = Math.max(top + radius, Math.min(y, bottom - radius - 1))
      if ((x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2) setPixel(x, y, colour)
    }
  }
}

const circle = (centreX: number, centreY: number, radius: number, colour: readonly number[]) => {
  for (let y = centreY - radius; y <= centreY + radius; y += 1) {
    for (let x = centreX - radius; x <= centreX + radius; x += 1) {
      if ((x - centreX) ** 2 + (y - centreY) ** 2 <= radius ** 2) setPixel(x, y, colour)
    }
  }
}

const glyphs: Record<string, string[]> = {
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
  N: ['10001', '11001', '11001', '10101', '10011', '10011', '10001'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
}

const drawWord = (word: string, left: number, top: number, scale: number, colour: readonly number[]) => {
  let cursor = left
  for (const character of word) {
    if (character === ' ') { cursor += scale * 3; continue }
    const glyph = glyphs[character]
    if (!glyph) continue
    glyph.forEach((row, rowIndex) => [...row].forEach((pixel, columnIndex) => {
      if (pixel === '1') roundedRect(
        cursor + columnIndex * scale,
        top + rowIndex * scale,
        cursor + (columnIndex + 1) * scale - 2,
        top + (rowIndex + 1) * scale - 2,
        Math.max(1, Math.floor(scale / 5)),
        colour,
      )
    }))
    cursor += scale * 6
  }
}

fill(colours.background)
circle(1060, 60, 270, [252, 231, 239, 255])
circle(90, 590, 230, [255, 235, 242, 255])
roundedRect(55, 45, 1145, 585, 44, colours.surface)
roundedRect(90, 80, 560, 550, 36, colours.pink)
roundedRect(185, 114, 465, 198, 32, colours.plum)
roundedRect(220, 92, 430, 128, 17, colours.plum)
roundedRect(250, 105, 400, 128, 11, colours.surface)
roundedRect(225, 141, 425, 171, 8, colours.gold)
roundedRect(318, 132, 326, 182, 3, colours.surface)
circle(245, 360, 112, colours.blush)
circle(245, 360, 62, colours.pinkStrong)
circle(435, 360, 74, colours.blush)
roundedRect(428, 292, 442, 358, 7, colours.plum)
drawWord('PINK', 640, 175, 14, colours.plum)
drawWord('FM', 640, 315, 19, colours.pinkStrong)
roundedRect(640, 485, 1010, 500, 7, colours.gold)
roundedRect(1027, 469, 1042, 516, 7, colours.pinkStrong)

const output = resolve(process.cwd(), 'public', 'pink-fm-preview.png')
const data = PNG.sync.write(png, { colorType: 6 })
if (!existsSync(output) || !readFileSync(output).equals(data)) writeFileSync(output, data)
console.log('Generated Pink FM share preview: 1200 × 630.')
