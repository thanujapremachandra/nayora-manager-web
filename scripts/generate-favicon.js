// Generates a real favicon.ico (browsers fetch it directly regardless of
// <link rel="icon"> tags). Modern ICO format allows embedding a PNG
// directly, so this just wraps a 32x32 PNG in a minimal ICO container.
const sharp = require('sharp')
const fs = require('fs')
const path = require('path')

async function main() {
  const svg = path.join(__dirname, '../public/icons/icon.svg')
  const pngBuffer = await sharp(svg).resize(32, 32).png().toBuffer()

  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(1, 4) // image count

  const entry = Buffer.alloc(16)
  entry.writeUInt8(32, 0) // width
  entry.writeUInt8(32, 1) // height
  entry.writeUInt8(0, 2) // color palette
  entry.writeUInt8(0, 3) // reserved
  entry.writeUInt16LE(1, 4) // color planes
  entry.writeUInt16LE(32, 6) // bits per pixel
  entry.writeUInt32LE(pngBuffer.length, 8) // image size
  entry.writeUInt32LE(22, 12) // offset (6 header + 16 entry)

  const ico = Buffer.concat([header, entry, pngBuffer])
  fs.writeFileSync(path.join(__dirname, '../src/app/favicon.ico'), ico)
  console.log('Generated src/app/favicon.ico')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
