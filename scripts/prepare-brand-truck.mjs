import { readFile } from 'node:fs/promises'
import sharp from 'sharp'

// Reconstitui a transparência usando a máscara que acompanha o SVG original.
const svg = await readFile('public/logos/RP_icon.svg', 'utf8')
const images = [...svg.matchAll(/<image[^>]*?(?:xlink:)?href="data:image\/[^;]+;base64,([^"]+)"/g)]
if (images.length !== 2) throw new Error('O SVG deve conter a máscara e a imagem do caminhão.')
const mask = await sharp(Buffer.from(images[0][1], 'base64')).greyscale().raw().toBuffer({ resolveWithObject: true })
const color = await sharp(Buffer.from(images[1][1], 'base64')).toColourspace('srgb').removeAlpha().raw().toBuffer({ resolveWithObject: true })
if (mask.info.width !== color.info.width || mask.info.height !== color.info.height || mask.info.channels !== 1 || color.info.channels !== 3) throw new Error('Imagem e máscara incompatíveis.')
const rgba = Buffer.alloc(mask.data.length * 4)
for (let pixel = 0; pixel < mask.data.length; pixel++) {
  color.data.copy(rgba, pixel * 4, pixel * 3, pixel * 3 + 3)
  rgba[pixel * 4 + 3] = mask.data[pixel]
}
await sharp(rgba, { raw: { width: color.info.width, height: color.info.height, channels: 4 } }).webp({ quality: 90 }).toFile('public/logos/rp-truck.webp')
