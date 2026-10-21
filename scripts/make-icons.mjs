import { chromium } from '/opt/node-tools/node_modules/playwright/index.mjs';
import fs from 'fs';
const out = '/home/user/bothaina/public';
const font = 'file:///home/user/bothaina/node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic-600-normal.woff2';

function flower(size, cx, cy) {
  const petals = [];
  for (let i = 0; i < 5; i++) {
    const a = i * 72;
    petals.push(`<path transform="rotate(${a} ${cx} ${cy})" d="M ${cx} ${cy} C ${cx - size*0.55} ${cy - size*0.35}, ${cx - size*0.42} ${cy - size*1.02}, ${cx - size*0.08} ${cy - size*0.98} L ${cx} ${cy - size*0.86} L ${cx + size*0.08} ${cy - size*0.98} C ${cx + size*0.42} ${cy - size*1.02}, ${cx + size*0.55} ${cy - size*0.35}, ${cx} ${cy} Z" fill="url(#petal)" stroke="#f3a9c0" stroke-width="${size*0.02}"/>`);
  }
  const dots = [];
  for (let i = 0; i < 5; i++) {
    const a = (i * 72 + 36) * Math.PI / 180;
    dots.push(`<line x1="${cx}" y1="${cy}" x2="${cx + Math.sin(a)*size*0.3}" y2="${cy - Math.cos(a)*size*0.3}" stroke="#e46f96" stroke-width="${size*0.025}" stroke-linecap="round"/><circle cx="${cx + Math.sin(a)*size*0.32}" cy="${cy - Math.cos(a)*size*0.32}" r="${size*0.04}" fill="#e46f96"/>`);
  }
  return petals.join('') + dots.join('') + `<circle cx="${cx}" cy="${cy}" r="${size*0.12}" fill="#f7b733" opacity="0.9"/>`;
}

const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd3e1"/><stop offset="0.55" stop-color="#f7bcd3"/><stop offset="1" stop-color="#d9bdf0"/></linearGradient>
  <radialGradient id="petal" cx="0.5" cy="0.8" r="0.9"><stop offset="0" stop-color="#ffe4ee"/><stop offset="1" stop-color="#ffffff"/></radialGradient>
  <filter id="sh" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#b0507a" flood-opacity="0.28"/></filter>
</defs>`;

function iconSvg(s, scale = 1) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 512 512">${defs}
  <rect width="512" height="512" fill="url(#bg)"/>
  <circle cx="420" cy="90" r="60" fill="#fff" opacity="0.25"/><circle cx="80" cy="440" r="90" fill="#fff" opacity="0.18"/>
  <g filter="url(#sh)" transform="translate(256 256) scale(${scale}) translate(-256 -256)">${flower(190, 256, 268)}</g></svg>`;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
const page = await browser.newPage();
async function shot(html, w, h, file) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><head><style>@font-face{font-family:M;src:url(${font})}body{margin:0}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: file, clip: { x: 0, y: 0, width: w, height: h } });
}
fs.mkdirSync(out + '/icons', { recursive: true });
fs.mkdirSync(out + '/splash', { recursive: true });
for (const [s, f, sc] of [[512, 'icon-512.png', 1], [192, 'icon-192.png', 1], [180, 'apple-touch-icon.png', 1], [512, 'icon-maskable-512.png', 0.78]]) {
  await shot(iconSvg(s, sc), s, s, out + '/icons/' + f);
}
for (const [w, h] of [[1284, 2778], [1290, 2796], [1170, 2532]]) {
  const html = `<div style="width:${w}px;height:${h}px;background:linear-gradient(170deg,#ffd9e6 0%,#fbe3ee 45%,#efe2f8 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:M">
    <svg width="${w*0.42}" height="${w*0.42}" viewBox="0 0 512 512">${defs}<g filter="url(#sh)">${flower(200, 256, 270)}</g></svg>
    <div dir="rtl" style="font-size:${w*0.16}px;color:#9c4a72;margin-top:${w*0.02}px">بثينة</div></div>`;
  await shot(html, w, h, `${out}/splash/splash-${w}x${h}.png`);
}
await browser.close();
console.log('ok');
