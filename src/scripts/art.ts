// Author: Ahmad Shaukat
// Background art: a shield drawn as a node mesh with a keyhole, a network field with padlock
// nodes, circuit traces with signal pulses, particles dissolving off the shield edge, bokeh and a
// slow shield-shaped scan ring. Original artwork generated in the browser: no image download,
// it follows the theme, and a fixed seed draws the same picture on every visit.
//
// Three variants: "hero" (home, centred on the evidence panel), "page" (inner page heads) and
// "ambient" (a faint fixed layer that the CSS mask keeps to the screen margins on wide screens).
// Glow is drawn as soft halo strokes and pre-rendered sprites rather than canvas shadows, which
// keeps the first frame fast on integrated graphics. Purely decorative; hosts are aria-hidden.

type Theme = 'dark' | 'light';
type Variant = 'hero' | 'page' | 'ambient';
type Pt = { x: number; y: number };

interface Palette {
  line: string;
  node: string;
  amber: string;
  blob: string;
  blobAmber: string;
  halo: number;
  blend: GlobalCompositeOperation;
}

const PALETTES: Record<Theme, Palette> = {
  dark: {
    line: '92, 170, 255',
    node: '214, 236, 255',
    amber: '242, 179, 61',
    blob: 'rgba(40, 120, 255, 0.17)',
    blobAmber: 'rgba(242, 179, 61, 0.07)',
    halo: 1,
    blend: 'lighter',
  },
  light: {
    line: '36, 87, 184',
    node: '28, 66, 138',
    amber: '168, 112, 15',
    blob: 'rgba(36, 87, 184, 0.07)',
    blobAmber: 'rgba(226, 160, 33, 0.07)',
    halo: 0,
    blend: 'source-over',
  },
};

interface Shield {
  focus: Pt;
  R: number;
  outline: Pt[];
  mesh: [Pt, Pt][];
  nodes: { p: Pt; amber: boolean }[];
  keyhole: boolean;
}

interface Trace {
  pts: Pt[];
  len: number;
  period: number;
  phase: number;
  amber: boolean;
}

interface Scene {
  w: number;
  h: number;
  shields: Shield[];
  fieldEdges: [Pt, Pt, number][];
  field: Pt[];
  traces: Trace[];
  dust: { p: Pt; r: number; a: number; amber: boolean }[];
  locks: { p: Pt; s: number; amber: boolean }[];
  pixels: { p: Pt; s: number; a: number; amber: boolean }[];
  bokeh: { p: Pt; r: number; a: number; amber: boolean }[];
  intensity: number;
}

const seeded = (seed: number) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);
const scaleAbout = (poly: Pt[], c: Pt, s: number) => poly.map((p) => ({ x: c.x + (p.x - c.x) * s, y: c.y + (p.y - c.y) * s }));

/** A heater shield: shoulders, straight sides, then a curve into the point. Closed loop. */
function shieldOutline(c: Pt, R: number): Pt[] {
  const hw = R * 0.84;
  const right: Pt[] = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    right.push({ x: c.x + hw * t, y: c.y - R + R * 0.26 * t * t });
  }
  for (let i = 1; i <= 5; i++) right.push({ x: c.x + hw, y: c.y - R * 0.74 + R * 0.79 * (i / 5) });
  const a = { x: c.x + hw, y: c.y + R * 0.05 };
  const k = { x: c.x + hw, y: c.y + R * 0.62 };
  const b = { x: c.x, y: c.y + R };
  for (let i = 1; i <= 8; i++) {
    const t = i / 8;
    const u = 1 - t;
    right.push({ x: u * u * a.x + 2 * u * t * k.x + t * t * b.x, y: u * u * a.y + 2 * u * t * k.y + t * t * b.y });
  }
  const left = right
    .slice(1, -1)
    .reverse()
    .map((p) => ({ x: 2 * c.x - p.x, y: p.y }));
  return [...right, ...left];
}

function inside(p: Pt, poly: Pt[]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) hit = !hit;
  }
  return hit;
}

function buildShield(rand: () => number, focus: Pt, R: number, keyhole: boolean): Shield {
  const outline = shieldOutline(focus, R);
  const step = R / 3.1;
  const core = scaleAbout(outline, focus, 0.9);
  const inner: Pt[] = [];
  for (let y = focus.y - R; y <= focus.y + R; y += step) {
    for (let x = focus.x - R; x <= focus.x + R; x += step) {
      const p = { x: x + (rand() - 0.5) * step * 0.7, y: y + (rand() - 0.5) * step * 0.7 };
      if (inside(p, core)) inner.push(p);
    }
  }
  const all = [...outline, ...inner];
  const seen = new Set<string>();
  const mesh: [Pt, Pt][] = [];
  const link = (a: Pt, b: Pt) => {
    const key = [a.x, a.y, b.x, b.y].map((n) => n.toFixed(1)).sort().join('|');
    if (!seen.has(key)) {
      seen.add(key);
      mesh.push([a, b]);
    }
  };
  for (let i = 0; i < outline.length; i++) link(outline[i], outline[(i + 1) % outline.length]);
  for (const p of inner) {
    all
      .filter((q) => q !== p)
      .sort((a, b) => dist(p, a) - dist(p, b))
      .slice(0, 3)
      .forEach((q) => link(p, q));
  }
  return { focus, R, outline, mesh, nodes: all.map((p) => ({ p, amber: rand() < 0.08 })), keyhole };
}

function buildScene(variant: Variant, w: number, h: number, focus: Pt, R: number): Scene {
  const rand = seeded(variant === 'hero' ? 20261012 : variant === 'page' ? 20261019 : 20261021);
  const shields =
    variant === 'ambient'
      ? [
          buildShield(rand, { x: -w * 0.02, y: h * 0.34 }, h * 0.3, false),
          buildShield(rand, { x: w * 1.02, y: h * 0.7 }, h * 0.34, false),
        ]
      : [buildShield(rand, focus, R, true)];

  const big = variant === 'hero';
  const count = big ? 150 : variant === 'page' ? 70 : 110;
  const reach = Math.max(w, h) * (big ? 0.85 : 0.7);
  const keepOut = shields.map((s) => scaleAbout(s.outline, s.focus, 1.12));
  const field: Pt[] = [];
  for (let tries = 0; field.length < count && tries < count * 20; tries++) {
    let p: Pt;
    if (variant === 'ambient') {
      p = { x: rand() * w, y: rand() * h };
    } else {
      const ang = rand() * Math.PI * 2;
      const r = R * 1.1 + Math.pow(rand(), 0.85) * reach;
      p = { x: focus.x + Math.cos(ang) * r * 1.25, y: focus.y + Math.sin(ang) * r };
    }
    if (p.x < -40 || p.x > w + 40 || p.y < -40 || p.y > h + 40 || keepOut.some((k) => inside(p, k))) continue;
    field.push(p);
  }
  const reachEdge = variant === 'ambient' ? Math.min(w, h) * 0.16 : R * 0.62;
  const fieldEdges: [Pt, Pt, number][] = [];
  for (let i = 0; i < field.length; i++) {
    for (let j = i + 1; j < field.length; j++) {
      const d = dist(field[i], field[j]);
      if (d < reachEdge) fieldEdges.push([field[i], field[j], 1 - d / reachEdge]);
    }
  }

  const traces: Trace[] = [];
  for (const s of shields) {
    const tCount = big ? 18 : 9;
    for (let i = 0; i < tCount; i++) {
      const start = s.outline[Math.floor(((i + rand() * 0.6) / tCount) * s.outline.length) % s.outline.length];
      const v = { x: start.x - s.focus.x, y: start.y - s.focus.y };
      const horiz = Math.abs(v.x) > Math.abs(v.y) * 0.9;
      const dir = horiz ? { x: Math.sign(v.x) || 1, y: 0 } : { x: 0, y: Math.sign(v.y) || 1 };
      const perp = horiz ? { x: 0, y: rand() < 0.5 ? -1 : 1 } : { x: rand() < 0.5 ? -1 : 1, y: 0 };
      const l1 = s.R * (0.1 + rand() * 0.26);
      const l2 = s.R * (0.08 + rand() * 0.2);
      const l3 = s.R * (0.22 + rand() * 0.6);
      const p0 = { x: start.x + dir.x * s.R * 0.04, y: start.y + dir.y * s.R * 0.04 };
      const p1 = { x: p0.x + dir.x * l1, y: p0.y + dir.y * l1 };
      const p2 = { x: p1.x + ((dir.x + perp.x) * l2) / Math.SQRT2, y: p1.y + ((dir.y + perp.y) * l2) / Math.SQRT2 };
      const p3 = { x: p2.x + dir.x * l3, y: p2.y + dir.y * l3 };
      traces.push({
        pts: [p0, p1, p2, p3],
        len: dist(p0, p1) + dist(p1, p2) + dist(p2, p3),
        period: 2.6 + rand() * 3.2,
        phase: rand() * 6,
        amber: rand() < 0.22,
      });
    }
  }

  const dust: Scene['dust'] = [];
  const dustCount = big ? 320 : variant === 'page' ? 130 : 220;
  for (let i = 0; i < dustCount; i++) {
    let p: Pt;
    if (variant === 'ambient') p = { x: rand() * w, y: rand() * h };
    else {
      const ang = rand() * Math.PI * 2;
      const r = Math.pow(rand(), 0.6) * reach * 1.1;
      p = { x: focus.x + Math.cos(ang) * r * 1.3, y: focus.y + Math.sin(ang) * r };
    }
    if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) continue;
    dust.push({ p, r: 0.4 + rand() * 1.3, a: 0.08 + rand() * 0.55, amber: rand() < 0.08 });
  }

  const lockMinX = w * (big ? 0.62 : 0.55);
  const locks = field
    .filter((p) => variant === 'ambient' || (p.x > lockMinX && dist(p, focus) > R * 1.6))
    .sort(() => rand() - 0.5)
    .slice(0, big ? 6 : variant === 'page' ? 3 : 6)
    .map((p) => ({ p, s: 0.85 + rand() * 0.5, amber: rand() < 0.3 }));

  // Each shield's inner edge dissolves into square particles.
  const pixels: Scene['pixels'] = [];
  for (const s of shields) {
    const dir = variant === 'ambient' && s.focus.x > w / 2 ? -1 : 1;
    const edge = s.outline.filter((p) => (p.x - s.focus.x) * dir > s.R * 0.25);
    const n = big ? 260 : 120;
    for (let i = 0; i < n && edge.length; i++) {
      const from = edge[Math.floor(rand() * edge.length)];
      const k = Math.pow(rand(), 1.7);
      const p = {
        x: from.x + dir * (k * s.R * 1.9 + rand() * s.R * 0.08),
        y: from.y + (rand() - 0.5) * s.R * (0.25 + k * 0.9),
      };
      if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) continue;
      pixels.push({ p, s: (1 - k) * 2.6 + 0.6, a: (1 - k) * 0.85 + 0.08, amber: rand() < 0.1 });
    }
  }

  const bokeh: Scene['bokeh'] = [];
  for (const s of shields) {
    for (let i = 0; i < (big ? 12 : 6); i++) {
      const ang = rand() * Math.PI * 2;
      const r = s.R * (0.9 + rand() * 2.4);
      bokeh.push({
        p: { x: s.focus.x + Math.cos(ang) * r * 1.2, y: s.focus.y + Math.sin(ang) * r * 0.8 },
        r: s.R * (0.05 + rand() * 0.15),
        a: 0.05 + rand() * 0.11,
        amber: rand() < 0.3,
      });
    }
  }

  return { w, h, shields, field, fieldEdges, traces, dust, locks, pixels, bokeh, intensity: variant === 'ambient' ? 0.55 : 1 };
}

/** A soft round glow, drawn once per colour and stamped wherever a node or pulse needs one. */
const sprites = new Map<string, HTMLCanvasElement>();
function glowSprite(rgb: string) {
  let c = sprites.get(rgb);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, `rgba(${rgb}, 0.9)`);
    grad.addColorStop(0.25, `rgba(${rgb}, 0.35)`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    g.fillStyle = grad;
    g.fillRect(0, 0, 64, 64);
  }
  sprites.set(rgb, c);
  return c;
}

function stamp(ctx: CanvasRenderingContext2D, rgb: string, p: Pt, size: number) {
  ctx.drawImage(glowSprite(rgb), p.x - size / 2, p.y - size / 2, size, size);
}

function poly(ctx: CanvasRenderingContext2D, pts: Pt[], close = false) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  if (close) ctx.closePath();
}

/** A glowing stroke: two wide faint halo passes under a thin bright core. */
function glowStroke(ctx: CanvasRenderingContext2D, rgb: string, alpha: number, width: number, halo: number) {
  if (halo) {
    ctx.lineWidth = width * 5;
    ctx.strokeStyle = `rgba(${rgb}, ${(alpha * 0.12 * halo).toFixed(3)})`;
    ctx.stroke();
    ctx.lineWidth = width * 2.4;
    ctx.strokeStyle = `rgba(${rgb}, ${(alpha * 0.22 * halo).toFixed(3)})`;
    ctx.stroke();
  }
  ctx.lineWidth = width;
  ctx.strokeStyle = `rgba(${rgb}, ${alpha.toFixed(3)})`;
  ctx.stroke();
}

function drawLock(ctx: CanvasRenderingContext2D, c: Pt, scale: number, rgb: string, k: number, halo: number) {
  const bw = 11 * scale;
  const bh = 8.5 * scale;
  ctx.beginPath();
  ctx.arc(c.x, c.y - bh * 0.42, bw * 0.3, Math.PI, 0);
  glowStroke(ctx, rgb, 0.95 * k, 1.3, halo);
  ctx.beginPath();
  ctx.rect(c.x - bw / 2, c.y - bh * 0.42, bw, bh);
  ctx.fillStyle = `rgba(${rgb}, ${(0.14 * k).toFixed(3)})`;
  ctx.fill();
  glowStroke(ctx, rgb, 0.95 * k, 1.3, halo);
  ctx.fillStyle = `rgba(${rgb}, ${(0.95 * k).toFixed(3)})`;
  ctx.beginPath();
  ctx.arc(c.x, c.y + bh * 0.05, 1.3 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawKeyhole(ctx: CanvasRenderingContext2D, f: Pt, R: number, rgb: string, halo: number) {
  const top = f.y - R * 0.12;
  ctx.beginPath();
  ctx.arc(f.x, top, R * 0.13, Math.PI * 0.72, Math.PI * 2.28);
  ctx.lineTo(f.x + R * 0.11, f.y + R * 0.26);
  ctx.lineTo(f.x - R * 0.11, f.y + R * 0.26);
  ctx.closePath();
  ctx.fillStyle = `rgba(${rgb}, 0.12)`;
  ctx.fill();
  glowStroke(ctx, rgb, 0.95, 1.8, halo);
}

function drawStatic(ctx: CanvasRenderingContext2D, s: Scene, pal: Palette, dpr: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = s.intensity;

  for (const sh of s.shields) {
    const f = sh.focus;
    const blob = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, sh.R * 2.9);
    blob.addColorStop(0, pal.blob);
    blob.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = blob;
    ctx.fillRect(0, 0, s.w, s.h);
    const warm = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, sh.R * 1.15);
    warm.addColorStop(0, pal.blobAmber);
    warm.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = warm;
    ctx.fillRect(0, 0, s.w, s.h);
  }

  ctx.globalCompositeOperation = pal.blend;

  for (const b of s.bokeh) {
    const g = ctx.createRadialGradient(b.p.x, b.p.y, 0, b.p.x, b.p.y, b.r);
    const rgb = b.amber ? pal.amber : pal.line;
    g.addColorStop(0, `rgba(${rgb}, ${(b.a * k).toFixed(3)})`);
    g.addColorStop(0.7, `rgba(${rgb}, ${(b.a * 0.6 * k).toFixed(3)})`);
    g.addColorStop(1, `rgba(${rgb}, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(b.p.x, b.p.y, b.r, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const d of s.dust) {
    ctx.fillStyle = `rgba(${d.amber ? pal.amber : pal.node}, ${(d.a * k).toFixed(3)})`;
    ctx.beginPath();
    ctx.arc(d.p.x, d.p.y, d.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = 0.6;
  for (const [a, b, q] of s.fieldEdges) {
    ctx.strokeStyle = `rgba(${pal.line}, ${(q * 0.34 * k).toFixed(3)})`;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.fillStyle = `rgba(${pal.node}, ${(0.55 * k).toFixed(3)})`;
  for (const p of s.field) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  for (const t of s.traces) {
    const rgb = t.amber ? pal.amber : pal.line;
    poly(ctx, t.pts);
    glowStroke(ctx, rgb, 0.5 * k, 1.1, pal.halo);
    const end = t.pts[t.pts.length - 1];
    ctx.beginPath();
    ctx.arc(end.x, end.y, 2.6, 0, Math.PI * 2);
    glowStroke(ctx, rgb, 0.6 * k, 1.1, pal.halo);
  }

  for (const sh of s.shields) {
    ctx.lineWidth = 0.75;
    ctx.strokeStyle = `rgba(${pal.line}, ${(0.42 * k).toFixed(3)})`;
    ctx.beginPath();
    for (const [a, b] of sh.mesh) {
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    poly(ctx, sh.outline, true);
    glowStroke(ctx, pal.line, 0.95 * k, 1.9, pal.halo * 1.3);
    poly(ctx, scaleAbout(sh.outline, sh.focus, 1.07), true);
    glowStroke(ctx, pal.line, 0.35 * k, 1, pal.halo);
    if (sh.keyhole) drawKeyhole(ctx, sh.focus, sh.R, pal.node, pal.halo);
  }

  for (const px of s.pixels) {
    ctx.fillStyle = `rgba(${px.amber ? pal.amber : pal.node}, ${(px.a * k).toFixed(3)})`;
    ctx.fillRect(px.p.x - px.s / 2, px.p.y - px.s / 2, px.s, px.s);
  }

  for (const l of s.locks) drawLock(ctx, l.p, l.s, l.amber ? pal.amber : pal.node, k, pal.halo);

  for (const sh of s.shields) {
    for (const n of sh.nodes) {
      if (pal.halo) stamp(ctx, n.amber ? pal.amber : pal.line, n.p, n.amber ? 22 : 16);
      ctx.fillStyle = `rgba(${n.amber ? pal.amber : pal.node}, ${(0.92 * k).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(n.p.x, n.p.y, n.amber ? 2.2 : 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  ctx.globalCompositeOperation = 'source-over';
}

function pointAt(t: Trace, q: number): Pt {
  let left = q * t.len;
  for (let i = 0; i < t.pts.length - 1; i++) {
    const a = t.pts[i];
    const b = t.pts[i + 1];
    const d = dist(a, b);
    if (left <= d) return { x: a.x + ((b.x - a.x) * left) / d, y: a.y + ((b.y - a.y) * left) / d };
    left -= d;
  }
  return t.pts[t.pts.length - 1];
}

function drawFx(ctx: CanvasRenderingContext2D, s: Scene, pal: Palette, dpr: number, time: number) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = pal.blend;
  const sec = time / 1000;

  for (const t of s.traces) {
    const q = ((sec + t.phase) % t.period) / t.period;
    if (q > 0.82) continue;
    const head = pointAt(t, q / 0.82);
    const tail = pointAt(t, Math.max(0, q / 0.82 - 0.12));
    const rgb = t.amber ? pal.amber : pal.node;
    const grad = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    grad.addColorStop(0, `rgba(${rgb}, 0)`);
    grad.addColorStop(1, `rgba(${rgb}, 0.9)`);
    ctx.strokeStyle = grad;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
    if (pal.halo) stamp(ctx, t.amber ? pal.amber : pal.line, head, 26);
    ctx.fillStyle = `rgba(${rgb}, 1)`;
    ctx.beginPath();
    ctx.arc(head.x, head.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // A shield-shaped scan ring leaves the outline every few seconds.
  const k = (sec % 7) / 7;
  if (k < 0.62) {
    for (const sh of s.shields) {
      poly(ctx, scaleAbout(sh.outline, sh.focus, 1.04 + k * 0.95), true);
      glowStroke(ctx, pal.line, 0.42 * (1 - k / 0.62), 1.4, pal.halo * 0.6);
    }
  }
  ctx.globalCompositeOperation = 'source-over';
}

/** Mounts the art inside a host element with data-art set to hero, page or ambient. */
export function mountArt(host: HTMLElement) {
  const variant: Variant = host.dataset.art === 'page' ? 'page' : host.dataset.art === 'ambient' ? 'ambient' : 'hero';
  const base = document.createElement('canvas');
  const fx = document.createElement('canvas');
  host.append(base, fx);
  const bctx = base.getContext('2d');
  const fctx = fx.getContext('2d');
  if (!bctx || !fctx) return;

  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const animated = !reduced && variant !== 'ambient';
  const theme = (): Theme => (root.dataset.theme === 'light' ? 'light' : 'dark');
  let scene: Scene | null = null;
  let signature = '';
  let dpr = 1;
  let visible = true;
  let last = 0;

  const build = () => {
    // The ambient layer only shows in the margins of wide screens; skip the work elsewhere.
    if (variant === 'ambient' && window.innerWidth < 1280) {
      host.removeAttribute('data-ready');
      return;
    }
    const box = host.getBoundingClientRect();
    const w = Math.round(box.width);
    const h = Math.round(box.height);
    if (!w || !h) return;
    let focus: Pt = { x: w * 0.84, y: h * 0.5 };
    let R = h * 0.42;
    if (variant === 'hero') {
      const panel = document.querySelector('.trail');
      if (panel) {
        const p = panel.getBoundingClientRect();
        focus = { x: p.left - box.left + p.width / 2, y: p.top - box.top + p.height / 2 };
        R = Math.min(p.height * 0.64, h * 0.52);
      }
    }
    const nextDpr = Math.min(2, window.devicePixelRatio || 1);
    const sig = [w, h, Math.round(focus.x), Math.round(focus.y), Math.round(R), nextDpr].join(',');
    if (sig === signature) return;
    signature = sig;
    dpr = nextDpr;
    for (const c of [base, fx]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    scene = buildScene(variant, w, h, focus, R);
    drawStatic(bctx, scene, PALETTES[theme()], dpr);
    if (reduced && variant !== 'ambient') drawFx(fctx, scene, PALETTES[theme()], dpr, 2400);
    host.setAttribute('data-ready', '');
  };

  const loop = (now: number) => {
    requestAnimationFrame(loop);
    if (!scene || !visible || document.hidden || now - last < 33) return;
    last = now;
    drawFx(fctx, scene, PALETTES[theme()], dpr, now);
  };

  let timer = 0;
  new ResizeObserver(() => {
    window.clearTimeout(timer);
    timer = window.setTimeout(build, 120);
  }).observe(variant === 'ambient' ? root : host);
  new MutationObserver(() => scene && drawStatic(bctx, scene, PALETTES[theme()], dpr)).observe(root, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(host);

  build();
  // Web fonts can move the evidence panel once they load; rebuild only if the layout changed.
  document.fonts?.ready.then(build, () => undefined);
  if (animated) requestAnimationFrame(loop);
}
