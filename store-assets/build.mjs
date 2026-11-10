#!/usr/bin/env node
/**
 * Builds Play Store / App Store listing images from the raw emulator captures in ./raw.
 *
 *   node store-assets/build.mjs
 *
 * Output: store-assets/out/{play,appstore-6.9,appstore-6.5}/*.png, play/feature-graphic.png, play/icon-512.png
 * Needs Google Chrome (headless) and sharp (root node_modules).
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const sharp = require('sharp');

const ROOT = dirname(fileURLToPath(import.meta.url));
const RAW = join(ROOT, 'raw');
const OUT = join(ROOT, 'out');
const TMP = join(ROOT, '.tmp');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ICON = join(ROOT, '../apps/mobile/ios/Shopynn/Images.xcassets/AppIcon.appiconset/1024.png');

// Android status bar (63px) and gesture bar (63px) at 1080x2400 / 420dpi.
const CROP = { left: 0, top: 63, width: 1080, height: 2274 };

const SLIDES = [
	{ file: '01_dashboard', title: 'Your whole shop<br><em>at a glance</em>', sub: 'Sales, purchases, expenses and profit in one place' },
	{ file: '02_new_sale', title: 'Ring up sales<br><em>in seconds</em>', sub: 'Search, scan a barcode or just say the item' },
	{ file: '03_momo', title: 'Take <em>MoMo</em><br>at the counter', sub: 'MTN, Telecel and AirtelTigo. You choose who pays the fee' },
	{ file: '04_inventory', title: 'Always know<br><em>what’s in stock</em>', sub: 'Low-stock alerts before you run out' },
	{ file: '05_reports', title: 'Watch your<br><em>business grow</em>', sub: 'Daily sales, best sellers and staff reports' },
	{ file: '06_stores', title: 'Run every branch<br><em>from one app</em>', sub: 'Separate stock per store, with transfers between them' },
	{ file: '07_roles', title: 'Give staff the<br><em>right access</em>', sub: 'Cashier, manager or your own custom roles' },
];

const SIZES = [
	{ dir: 'play', w: 1080, h: 1920 },
	{ dir: 'appstore-6.9', w: 1320, h: 2868 },
	{ dir: 'appstore-6.5', w: 1284, h: 2778 },
];

const BRAND = {
	bgTop: '#0A1F3D',
	bgBottom: '#0F5FCC',
	accent: '#FF9142',
};

const fileUrl = (p) => `file://${p}`;

function slideHtml({ w, h }, slide, shotPath, iconPath) {
	const pad = Math.round(w * 0.08);
	const titleSize = Math.round(w * 0.088);
	const subSize = Math.round(w * 0.04);
	const brandSize = Math.round(w * 0.034);
	const phoneTop = Math.round(h * 0.3);
	const phoneMaxH = h - phoneTop - Math.round(h * 0.035);
	const bezel = Math.round(w * 0.018);
	const screenH = phoneMaxH - bezel * 2;
	const screenW = Math.round((screenH * CROP.width) / CROP.height);
	const radius = Math.round(screenW * 0.09);
	return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif;
 background:radial-gradient(ellipse at 85% 10%,rgba(255,145,66,.22),transparent 45%),
 linear-gradient(165deg,${BRAND.bgTop} 0%,${BRAND.bgBottom} 100%);color:#fff;position:relative}
.top{position:absolute;top:${Math.round(h * 0.045)}px;left:${pad}px;right:${pad}px;text-align:center}
.brand{display:inline-flex;align-items:center;gap:${Math.round(brandSize * 0.5)}px;font-size:${brandSize}px;font-weight:600;
 letter-spacing:.02em;opacity:.95;margin-bottom:${Math.round(h * 0.022)}px}
.brand img{width:${Math.round(brandSize * 1.9)}px;height:${Math.round(brandSize * 1.9)}px;border-radius:${Math.round(brandSize * 0.45)}px;background:#fff}
h1{font-size:${titleSize}px;line-height:1.08;font-weight:800;letter-spacing:-.02em}
h1 em{font-style:normal;color:${BRAND.accent}}
p{margin-top:${Math.round(h * 0.016)}px;font-size:${subSize}px;line-height:1.35;opacity:.85;font-weight:500;text-wrap:balance}
.phone{position:absolute;top:${phoneTop}px;left:50%;transform:translateX(-50%);padding:${bezel}px;
 background:#0b0b0d;border-radius:${radius + bezel}px;box-shadow:0 ${Math.round(h * 0.02)}px ${Math.round(h * 0.05)}px rgba(0,0,0,.45),0 0 0 2px rgba(255,255,255,.08)}
.phone img{display:block;width:${screenW}px;height:${screenH}px;border-radius:${radius}px}
</style></head><body>
<div class="top">
 <div class="brand"><img src="${fileUrl(iconPath)}">Shopynn</div>
 <h1>${slide.title}</h1>
 <p>${slide.sub}</p>
</div>
<div class="phone"><img src="${fileUrl(shotPath)}"></div>
</body></html>`;
}

function featureHtml(shotPath, iconPath) {
	const w = 1024;
	const h = 500;
	return `<!doctype html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${w}px;height:${h}px;overflow:hidden}
body{font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display","Helvetica Neue",Arial,sans-serif;color:#fff;position:relative;
 background:radial-gradient(ellipse at 90% 0%,rgba(255,145,66,.28),transparent 50%),linear-gradient(135deg,${BRAND.bgTop} 0%,${BRAND.bgBottom} 100%)}
.left{position:absolute;left:72px;top:50%;transform:translateY(-50%);width:520px}
.brand{display:flex;align-items:center;gap:18px;font-size:44px;font-weight:800;letter-spacing:-.01em}
.brand img{width:76px;height:76px;border-radius:18px;background:#fff}
h1{margin-top:26px;font-size:40px;line-height:1.12;font-weight:800;letter-spacing:-.015em}
h1 em{font-style:normal;color:${BRAND.accent}}
p{margin-top:14px;font-size:20px;opacity:.85;font-weight:500}
.phone{position:absolute;right:70px;top:46px;padding:9px;background:#0b0b0d;border-radius:38px;transform:rotate(6deg);
 box-shadow:0 20px 50px rgba(0,0,0,.5)}
.phone img{display:block;width:250px;height:${Math.round((250 * CROP.height) / CROP.width)}px;border-radius:30px}
</style></head><body>
<div class="left">
 <div class="brand"><img src="${fileUrl(iconPath)}">Shopynn</div>
 <h1>Sell, track stock and<br>take <em>MoMo</em> from your phone</h1>
 <p>Point of sale · Inventory · Reports · Staff</p>
</div>
<div class="phone"><img src="${fileUrl(shotPath)}"></div>
</body></html>`;
}

function render(html, w, h, outPath) {
	const htmlPath = join(TMP, `${Math.random().toString(36).slice(2)}.html`);
	writeFileSync(htmlPath, html);
	mkdirSync(dirname(outPath), { recursive: true });
	execFileSync(
		CHROME,
		[
			'--headless=new',
			'--disable-gpu',
			'--hide-scrollbars',
			'--force-device-scale-factor=1',
			'--allow-file-access-from-files',
			`--window-size=${w},${h}`,
			`--screenshot=${outPath}`,
			fileUrl(htmlPath),
		],
		{ stdio: 'ignore' }
	);
}

async function main() {
	rmSync(TMP, { recursive: true, force: true });
	mkdirSync(TMP, { recursive: true });

	const icon = join(TMP, 'icon.png');
	await sharp(ICON).resize(256, 256).png().toFile(icon);

	const cropped = {};
	for (const s of SLIDES) {
		const src = join(RAW, `${s.file}.png`);
		if (!existsSync(src)) throw new Error(`Missing capture: ${src}`);
		cropped[s.file] = join(TMP, `${s.file}.png`);
		await sharp(src).extract(CROP).png().toFile(cropped[s.file]);
	}

	for (const size of SIZES) {
		SLIDES.forEach((s, i) => {
			const out = join(OUT, size.dir, `${String(i + 1).padStart(2, '0')}_${s.file.replace(/^\d+_/, '')}.png`);
			render(slideHtml(size, s, cropped[s.file], icon), size.w, size.h, out);
			console.log(out);
		});
	}

	const feature = join(OUT, 'play', 'feature-graphic.png');
	render(featureHtml(cropped['01_dashboard'], icon), 1024, 500, feature);
	console.log(feature);

	const icon512 = join(OUT, 'play', 'icon-512.png');
	await sharp(ICON).resize(512, 512).flatten({ background: '#ffffff' }).png().toFile(icon512);
	console.log(icon512);

	// Stores reject alpha in screenshots; flatten everything to opaque RGB.
	for (const size of [...SIZES.map((s) => s.dir)]) {
		for (const [i, s] of SLIDES.entries()) {
			const p = join(OUT, size, `${String(i + 1).padStart(2, '0')}_${s.file.replace(/^\d+_/, '')}.png`);
			const buf = await sharp(p).flatten({ background: '#0A1F3D' }).removeAlpha().png().toBuffer();
			writeFileSync(p, buf);
		}
	}
	const fbuf = await sharp(feature).flatten({ background: '#0A1F3D' }).removeAlpha().png().toBuffer();
	writeFileSync(feature, fbuf);

	rmSync(TMP, { recursive: true, force: true });
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
