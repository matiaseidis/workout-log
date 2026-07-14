// Generates the PWA icons (flat barbell on plate-blue) without any image deps:
// raw RGBA buffers hand-encoded as PNG (IHDR/IDAT/IEND + CRC32, zlib deflate).
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'

const CRC_TABLE = new Int32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  CRC_TABLE[n] = c
}
function crc32(...bufs) {
  let c = ~0
  for (const b of bufs) for (const x of b) c = CRC_TABLE[(c ^ x) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}
function chunk(type, data) {
  const t = Buffer.from(type, 'ascii')
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(t, data))
  return Buffer.concat([len, t, data, crc])
}
function png(size, px) {
  const stride = size * 4 + 1
  const raw = Buffer.alloc(stride * size)
  for (let y = 0; y < size; y++) px.copy(raw, y * stride + 1, y * size * 4, (y + 1) * size * 4)
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const BG = [0x27, 0x57, 0xd6, 255]
const FG = [255, 255, 255, 255]

function makeIcon(size, scale = 1) {
  const px = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) px.set(BG, i * 4)
  // centered rounded rect; cx/cy/w/h/r as fractions of the icon size
  const rect = (cx, cy, w, h, r) => {
    const HW = (w * size * scale) / 2
    const HH = (h * size * scale) / 2
    const R = r * size * scale
    const X = cx * size
    const Y = cy * size
    for (let y = Math.max(0, Math.floor(Y - HH)); y < Math.min(size, Y + HH); y++)
      for (let x = Math.max(0, Math.floor(X - HW)); x < Math.min(size, X + HW); x++) {
        const dx = Math.max(Math.abs(x - X) - (HW - R), 0)
        const dy = Math.max(Math.abs(y - Y) - (HH - R), 0)
        if (dx * dx + dy * dy <= R * R) px.set(FG, (y * size + x) * 4)
      }
  }
  rect(0.5, 0.5, 0.82, 0.06, 0.03) // bar
  for (const s of [-1, 1]) {
    rect(0.5 + s * 0.24, 0.5, 0.085, 0.42, 0.035) // inner (big) plate
    rect(0.5 + s * 0.335, 0.5, 0.07, 0.3, 0.03) // outer (small) plate
  }
  return png(size, px)
}

mkdirSync('public/icons', { recursive: true })
writeFileSync('public/apple-touch-icon.png', makeIcon(180))
writeFileSync('public/icons/icon-192.png', makeIcon(192))
writeFileSync('public/icons/icon-512.png', makeIcon(512))
writeFileSync('public/icons/icon-512-maskable.png', makeIcon(512, 0.62))
console.log('icons written to public/')
