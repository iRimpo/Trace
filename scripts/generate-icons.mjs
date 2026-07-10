/**
 * Generate PWA icons from the Trace logo.
 * Usage: node scripts/generate-icons.mjs
 * Outputs: public/icons/icon-192.png, icon-512.png, apple-touch-icon.png
 */
import sharp from "sharp";
import { mkdir } from "fs/promises";

const BG = "#080808";
const SRC = "public/trace_logo.svg";

await mkdir("public/icons", { recursive: true });

async function makeIcon(size, out, padRatio = 0.18) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const logo = await sharp(SRC).resize(inner, inner, { fit: "contain", background: BG }).toBuffer();
  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);
  console.log(`✓ ${out} (${size}x${size})`);
}

await makeIcon(192, "public/icons/icon-192.png");
await makeIcon(512, "public/icons/icon-512.png");
await makeIcon(180, "public/icons/apple-touch-icon.png");
