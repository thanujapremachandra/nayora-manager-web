// Generate PWA icons from the SVG source.
// Run once after cloning: node scripts/generate-icons.js
// Requires: npm install --save-dev sharp  (one-time)

const sharp = require('sharp')
const path = require('path')

const sizes = [192, 512]
const svg = path.join(__dirname, '../public/icons/icon.svg')

async function main() {
  for (const size of sizes) {
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(path.join(__dirname, `../public/icons/icon-${size}.png`))
    console.log(`Generated icon-${size}.png`)
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
