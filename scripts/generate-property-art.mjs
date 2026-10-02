// Generates the abstract "photos" used by the sample property database
// (public/properties/*.svg). Deterministic — re-running produces identical
// files. Each sample listing gets an exterior scene that matches its type
// (tower, villa, townhouse, penthouse) plus an interior scene.
//
//   node scripts/generate-property-art.mjs

import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "public", "properties");
fs.mkdirSync(OUT, { recursive: true });

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const W = 1200;
const H = 800;

function sky(hue, r, warm) {
  const top = warm ? `hsl(${hue} 55% 72%)` : `hsl(${hue} 45% 62%)`;
  const bottom = warm ? `hsl(${(hue + 40) % 360} 75% 86%)` : `hsl(${(hue + 20) % 360} 50% 88%)`;
  const sunX = 200 + r() * 800;
  const sunY = 140 + r() * 160;
  return `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/>
    </linearGradient>
    <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#fff6dc" stop-opacity="1"/><stop offset="1" stop-color="#fff6dc" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#sky)"/>
  <circle cx="${sunX}" cy="${sunY}" r="160" fill="url(#sun)"/>
  <circle cx="${sunX}" cy="${sunY}" r="46" fill="#fff3d1" opacity="0.9"/>`;
}

function windows(x, y, w, h, cols, rows, r, lit) {
  let out = "";
  const gx = w / cols;
  const gy = h / rows;
  for (let c = 0; c < cols; c++) {
    for (let k = 0; k < rows; k++) {
      const on = r() < lit;
      out += `<rect x="${(x + c * gx + gx * 0.22).toFixed(1)}" y="${(y + k * gy + gy * 0.25).toFixed(1)}" width="${(gx * 0.56).toFixed(1)}" height="${(gy * 0.5).toFixed(1)}" rx="1.5" fill="${on ? "#fde9b8" : "#ffffff"}" opacity="${on ? 0.9 : 0.28}"/>`;
    }
  }
  return out;
}

function palm(x, base, scale, color) {
  const s = scale;
  let fronds = "";
  for (let i = 0; i < 8; i++) {
    const a = -175 + i * 24;
    fronds += `<path d="M0 0 Q ${30 * s} ${-30 * s} ${80 * s} ${8 * s} Q ${34 * s} ${4 * s} 0 0Z" fill="${color}" transform="rotate(${a})"/>`;
  }
  return `<g transform="translate(${x} ${base})">
    <path d="M0 0 C ${6 * s} ${-60 * s} ${-4 * s} ${-120 * s} ${8 * s} ${-180 * s}" stroke="${color}" stroke-width="${7 * s}" fill="none" stroke-linecap="round"/>
    <g transform="translate(${8 * s} ${-180 * s})">${fronds}</g>
  </g>`;
}

function water(hue, y) {
  let ripples = "";
  for (let i = 0; i < 14; i++) {
    const yy = y + 20 + i * 18;
    ripples += `<path d="M ${(i * 97) % 300} ${yy} h ${180 + ((i * 53) % 240)}" stroke="#ffffff" stroke-opacity="0.25" stroke-width="3" stroke-linecap="round"/>`;
    ripples += `<path d="M ${600 + ((i * 131) % 400)} ${yy + 8} h ${120 + ((i * 71) % 160)}" stroke="#ffffff" stroke-opacity="0.18" stroke-width="3" stroke-linecap="round"/>`;
  }
  return `<rect x="0" y="${y}" width="${W}" height="${H - y}" fill="hsl(${hue} 45% 48%)"/>${ripples}`;
}

function towerScene(seed, hue, opts = {}) {
  const r = rng(seed);
  const horizon = opts.waterfront ? 560 : 640;
  let back = "";
  for (let i = 0; i < 12; i++) {
    const w = 60 + r() * 70;
    const h = 120 + r() * 260;
    const x = i * 105 - 20 + r() * 30;
    back += `<rect x="${x.toFixed(0)}" y="${(horizon - h).toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" fill="hsl(${hue} 22% 70%)" opacity="0.65"/>`;
  }
  let front = "";
  const n = opts.hero ? 3 : 5;
  for (let i = 0; i < n; i++) {
    const w = opts.hero && i === 1 ? 190 : 110 + r() * 60;
    const h = opts.hero && i === 1 ? 560 : 260 + r() * 220;
    const x = (W / n) * i + 30 + r() * 40;
    const y = horizon - h;
    const shade = 30 + r() * 18;
    front += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${w.toFixed(0)}" height="${h.toFixed(0)}" rx="4" fill="hsl(${(hue + 190) % 360} 24% ${shade.toFixed(0)}%)"/>`;
    front += `<rect x="${x.toFixed(0)}" y="${y.toFixed(0)}" width="${(w * 0.35).toFixed(0)}" height="${h.toFixed(0)}" fill="#ffffff" opacity="0.08"/>`;
    front += windows(x, y + 12, w, h - 24, Math.round(w / 26), Math.round(h / 30), r, 0.35);
    if (opts.hero && i === 1) {
      front += `<path d="M ${x} ${y} L ${x + w / 2} ${y - 70} L ${x + w} ${y} Z" fill="hsl(${(hue + 190) % 360} 24% 34%)"/>`;
    }
  }
  const ground = opts.waterfront
    ? water(hue, horizon)
    : `<rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="hsl(${36 + (hue % 12)} 28% 64%)"/>`;
  const palms = opts.waterfront
    ? ""
    : [80, 1040, 1130].map((x) => palm(x, horizon + 30, 0.9, `hsl(140 26% 28%)`)).join("");
  return sky(hue, r, opts.warm) + back + front + ground + palms;
}

function villaScene(seed, hue) {
  const r = rng(seed);
  const horizon = 600;
  const wall = `hsl(${(hue + 30) % 360} 35% 90%)`;
  const roof = `hsl(${(hue + 10) % 360} 38% 46%)`;
  const x = 300;
  const y = 330;
  return (
    sky(hue, r, true) +
    `<rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="hsl(${95 + (hue % 25)} 30% 50%)"/>
    <rect x="${x}" y="${y}" width="600" height="${horizon - y}" fill="${wall}"/>
    <rect x="${x + 360}" y="${y - 90}" width="240" height="90" fill="${wall}"/>
    <path d="M ${x - 30} ${y} L ${x + 300} ${y - 120} L ${x + 330} ${y - 108} L ${x + 630} ${y} Z" fill="${roof}"/>
    <rect x="${x + 40}" y="${y + 60}" width="110" height="90" rx="4" fill="hsl(${hue} 40% 70%)" opacity="0.8"/>
    <rect x="${x + 200}" y="${y + 60}" width="110" height="90" rx="4" fill="hsl(${hue} 40% 70%)" opacity="0.8"/>
    <rect x="${x + 400}" y="${y + 120}" width="90" height="${horizon - y - 120}" rx="4" fill="hsl(${(hue + 10) % 360} 30% 38%)"/>
    <rect x="${x + 380}" y="${y - 60}" width="200" height="40" rx="3" fill="hsl(${hue} 40% 72%)" opacity="0.8"/>
    <rect x="80" y="${horizon + 70}" width="520" height="90" rx="14" fill="hsl(190 70% 62%)"/>
    <path d="M100 ${horizon + 110} h 140 M 320 ${horizon + 125} h 200" stroke="#fff" stroke-opacity=".5" stroke-width="4" stroke-linecap="round"/>` +
    [140, 1000, 1100].map((px, i) => palm(px, horizon + 10, 1.1 - i * 0.12, `hsl(140 28% 26%)`)).join("")
  );
}

function townhouseScene(seed, hue) {
  const r = rng(seed);
  const horizon = 610;
  let houses = "";
  for (let i = 0; i < 5; i++) {
    const x = 60 + i * 220;
    const h = 250 + (i % 2) * 30;
    const y = horizon - h;
    const tone = `hsl(${(hue + i * 14) % 360} 30% ${78 - (i % 2) * 8}%)`;
    houses += `<rect x="${x}" y="${y}" width="210" height="${h}" fill="${tone}"/>
      <path d="M ${x - 6} ${y} L ${x + 105} ${y - 70} L ${x + 216} ${y} Z" fill="hsl(${(hue + 200) % 360} 18% 36%)"/>
      <rect x="${x + 30}" y="${y + 50}" width="60" height="60" rx="3" fill="#fde9b8" opacity="${r() < 0.5 ? 0.85 : 0.35}"/>
      <rect x="${x + 120}" y="${y + 50}" width="60" height="60" rx="3" fill="#fde9b8" opacity="${r() < 0.5 ? 0.85 : 0.35}"/>
      <rect x="${x + 80}" y="${horizon - 100}" width="50" height="100" rx="3" fill="hsl(${(hue + 200) % 360} 22% 30%)"/>`;
  }
  return (
    sky(hue, r, false) +
    `<rect x="0" y="${horizon}" width="${W}" height="${H - horizon}" fill="hsl(${90 + (hue % 30)} 26% 54%)"/>` +
    houses +
    `<rect x="0" y="${horizon + 60}" width="${W}" height="40" fill="hsl(${hue} 8% 72%)"/>` +
    [30, 1170].map((x) => palm(x, horizon + 20, 0.8, `hsl(140 26% 28%)`)).join("")
  );
}

function interiorScene(seed, hue, opts = {}) {
  const r = rng(seed);
  const wall = `hsl(${(hue + 30) % 360} 22% 92%)`;
  const floor = `hsl(${(hue + 25) % 360} 25% 70%)`;
  const accent = `hsl(${hue} 42% 48%)`;
  const sofa = `hsl(${(hue + 180) % 360} 18% 42%)`;
  let skyline = "";
  for (let i = 0; i < 9; i++) {
    const h = 60 + r() * 170;
    skyline += `<rect x="${640 + i * 52}" y="${430 - h}" width="40" height="${h}" fill="hsl(${hue} 20% 60%)" opacity=".7"/>`;
  }
  return `
  <defs>
    <linearGradient id="win" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue} 55% 75%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360} 70% 90%)"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="${wall}"/>
  <rect x="0" y="560" width="${W}" height="240" fill="${floor}"/>
  <rect x="620" y="110" width="500" height="340" fill="url(#win)"/>
  ${opts.sea ? `<rect x="620" y="360" width="500" height="90" fill="hsl(${hue} 45% 55%)"/>` : skyline}
  <path d="M 870 110 V 450 M 620 280 H 1120" stroke="#fff" stroke-width="10"/>
  <rect x="610" y="100" width="520" height="360" fill="none" stroke="#ffffff" stroke-width="16"/>
  <rect x="120" y="150" width="200" height="260" fill="${accent}" opacity=".85"/>
  <circle cx="220" cy="280" r="70" fill="hsl(${(hue + 40) % 360} 70% 80%)" opacity=".9"/>
  <rect x="90" y="470" width="480" height="120" rx="22" fill="${sofa}"/>
  <rect x="70" y="440" width="60" height="150" rx="20" fill="${sofa}"/>
  <rect x="530" y="440" width="60" height="150" rx="20" fill="${sofa}"/>
  <rect x="150" y="440" width="120" height="60" rx="14" fill="hsl(${(hue + 30) % 360} 40% 82%)"/>
  <rect x="300" y="440" width="120" height="60" rx="14" fill="hsl(${hue} 40% 70%)"/>
  <ellipse cx="420" cy="690" rx="220" ry="40" fill="hsl(${(hue + 20) % 360} 30% 82%)"/>
  <rect x="350" y="620" width="150" height="16" rx="6" fill="hsl(${(hue + 200) % 360} 16% 30%)"/>
  <path d="M1040 600 v -150" stroke="hsl(${(hue + 200) % 360} 16% 30%)" stroke-width="6"/>
  <path d="M990 450 h 100 l -20 -60 h -60 Z" fill="hsl(40 80% 85%)"/>
  <rect x="680" y="560" width="70" height="90" rx="10" fill="hsl(${(hue + 30) % 360} 30% 55%)"/>
  <circle cx="700" cy="520" r="34" fill="hsl(130 30% 40%)"/><circle cx="735" cy="500" r="30" fill="hsl(130 32% 34%)"/><circle cx="720" cy="470" r="26" fill="hsl(130 30% 44%)"/>`;
}

// One entry per sample listing — keep in sync with lib/seed.ts.
const listings = [
  { slug: "lm-01", hue: 200, kind: "tower", waterfront: true, sea: true },
  { slug: "lm-02", hue: 210, kind: "tower", waterfront: true },
  { slug: "lm-03", hue: 25, kind: "tower", hero: true, warm: true },
  { slug: "lm-04", hue: 35, kind: "tower", hero: true, warm: true },
  { slug: "lm-05", hue: 185, kind: "tower" },
  { slug: "lm-06", hue: 170, kind: "villa", sea: true },
  { slug: "lm-07", hue: 95, kind: "townhouse" },
  { slug: "lm-08", hue: 45, kind: "villa" },
  { slug: "lm-09", hue: 150, kind: "townhouse" },
  { slug: "lm-10", hue: 260, kind: "tower", hero: true },
];

function svg(body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>\n`;
}

listings.forEach((l, i) => {
  const seed = 1000 + i * 77;
  let exterior;
  if (l.kind === "villa") exterior = villaScene(seed, l.hue);
  else if (l.kind === "townhouse") exterior = townhouseScene(seed, l.hue);
  else exterior = towerScene(seed, l.hue, l);
  fs.writeFileSync(path.join(OUT, `${l.slug}-a.svg`), svg(exterior));
  fs.writeFileSync(path.join(OUT, `${l.slug}-b.svg`), svg(interiorScene(seed + 5, l.hue, l)));
});

console.log(`Wrote ${listings.length * 2} images to ${OUT}`);
