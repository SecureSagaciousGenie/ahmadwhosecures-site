// Author: Ahmad Shaukat
// Threat surface canvas: disciplines orbit a shield, traffic flows along the links and
// hostile packets are blocked at the perimeter. Pauses offscreen and in background tabs.

type OrbitNode = {
  label: string;
  ring: 0 | 1;
  angle: number;
  speed: number;
  x: number;
  y: number;
  glow: number;
};

type Packet = { node: number; t: number; speed: number; inbound: boolean; hue: string };
type Threat = { angle: number; r: number; speed: number; wobble: number };
type Spark = { x: number; y: number; vx: number; vy: number; life: number };
type Floater = { x: number; y: number; life: number };

const LABELS_FULL = [
  'CMMC L2',
  'NIST 800-171',
  'ISO 27001',
  'SIEM',
  'DFIR',
  'MS 365',
  'Entra CA',
  'RMM',
  'HARDENING',
  'ZERO TRUST',
];

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

export function initThreatMap(root: HTMLElement, reduced: boolean): () => void {
  const canvas = root.querySelector<HTMLCanvasElement>('[data-threat-canvas]');
  if (!canvas) return () => {};
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};

  const hud = {
    inspected: root.querySelector<HTMLElement>('[data-tm="inspected"]'),
    blocked: root.querySelector<HTMLElement>('[data-tm="blocked"]'),
    uptime: root.querySelector<HTMLElement>('[data-tm="uptime"]'),
  };

  const C = {
    cyan: cssVar('--cyan', '#4cd6ff'),
    green: cssVar('--green', '#3ee6a0'),
    amber: cssVar('--amber', '#ffb648'),
    red: cssVar('--red', '#ff5c7a'),
    ink: cssVar('--ink', '#e6eef8'),
    ink3: cssVar('--ink-3', '#6e8098'),
    line: cssVar('--line-2', '#284060'),
  };

  let w = 0;
  let h = 0;
  let dpr = 1;
  let cx = 0;
  let cy = 0;
  let R = 0;
  let compact = false;

  const nodes: OrbitNode[] = [];
  const packets: Packet[] = [];
  const threats: Threat[] = [];
  const sparks: Spark[] = [];
  const floaters: Floater[] = [];

  let inspected = 0;
  let blocked = 0;
  let sweep = 0;
  let perimeterFlash = 0;
  let packetClock = 0;
  let threatClock = 1.2;
  let hudClock = 0;
  const started = performance.now();

  let mouseX = -9999;
  let mouseY = -9999;
  let tiltX = 0;
  let tiltY = 0;

  function buildNodes() {
    nodes.length = 0;
    const labels = compact ? LABELS_FULL.slice(0, 8) : LABELS_FULL;
    const innerCount = Math.ceil(labels.length / 2);
    labels.forEach((label, i) => {
      const ring: 0 | 1 = i < innerCount ? 0 : 1;
      const count = ring === 0 ? innerCount : labels.length - innerCount;
      const idx = ring === 0 ? i : i - innerCount;
      nodes.push({
        label,
        ring,
        angle: (idx / count) * Math.PI * 2 + (ring === 1 ? Math.PI / count : 0),
        speed: ring === 0 ? 0.07 : -0.045,
        x: 0,
        y: 0,
        glow: 0,
      });
    });
  }

  function resize() {
    const rect = canvas!.getBoundingClientRect();
    w = Math.max(1, rect.width);
    h = Math.max(1, rect.height);
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas!.width = Math.round(w * dpr);
    canvas!.height = Math.round(h * dpr);
    ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = w / 2;
    cy = h / 2;
    R = Math.min(w, h) * 0.4;
    const wasCompact = compact;
    compact = w < 440;
    if (nodes.length === 0 || wasCompact !== compact) buildNodes();
  }

  function ringRadius(ring: 0 | 1) {
    return ring === 0 ? R * 0.58 : R * 0.95;
  }

  const perimeter = () => R * 0.3;

  function spawnPacket() {
    if (!nodes.length) return;
    const node = (Math.random() * nodes.length) | 0;
    const inbound = Math.random() < 0.6;
    packets.push({
      node,
      t: 0,
      speed: 0.35 + Math.random() * 0.45,
      inbound,
      hue: inbound ? C.cyan : C.green,
    });
  }

  function spawnThreat() {
    threats.push({
      angle: Math.random() * Math.PI * 2,
      r: Math.hypot(w, h) * 0.6,
      speed: R * (0.35 + Math.random() * 0.25),
      wobble: Math.random() * Math.PI * 2,
    });
  }

  function burst(x: number, y: number) {
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 30 + Math.random() * 90;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1 });
    }
    floaters.push({ x, y, life: 1 });
  }

  function update(dt: number) {
    sweep = (sweep + dt * 0.9) % (Math.PI * 2);
    perimeterFlash = Math.max(0, perimeterFlash - dt * 1.6);

    tiltX += ((mouseX > -999 ? (mouseX - cx) * 0.025 : 0) - tiltX) * Math.min(1, dt * 4);
    tiltY += ((mouseY > -999 ? (mouseY - cy) * 0.025 : 0) - tiltY) * Math.min(1, dt * 4);

    for (const n of nodes) {
      n.angle += n.speed * dt;
      const r = ringRadius(n.ring);
      const depth = n.ring === 0 ? 0.6 : 1;
      n.x = cx + Math.cos(n.angle) * r + tiltX * depth;
      n.y = cy + Math.sin(n.angle) * r * 0.92 + tiltY * depth;
      const near = Math.hypot(mouseX - n.x, mouseY - n.y) < 70 ? 1 : 0;
      n.glow += (near - n.glow) * Math.min(1, dt * 6);
    }

    packetClock -= dt;
    if (packetClock <= 0) {
      spawnPacket();
      packetClock = compact ? 0.22 : 0.12;
    }

    threatClock -= dt;
    if (threatClock <= 0) {
      spawnThreat();
      threatClock = 1.4 + Math.random() * 1.8;
    }

    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      p.t += p.speed * dt;
      if (p.t >= 1) {
        if (p.inbound) inspected++;
        packets.splice(i, 1);
      }
    }

    for (let i = threats.length - 1; i >= 0; i--) {
      const t = threats[i];
      t.r -= t.speed * dt;
      t.wobble += dt * 6;
      if (t.r <= perimeter()) {
        const x = cx + Math.cos(t.angle) * perimeter() + tiltX * 0.4;
        const y = cy + Math.sin(t.angle) * perimeter() + tiltY * 0.4;
        burst(x, y);
        blocked++;
        perimeterFlash = 1;
        threats.splice(i, 1);
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.vx *= 0.94;
      s.vy *= 0.94;
      s.life -= dt * 1.6;
      if (s.life <= 0) sparks.splice(i, 1);
    }

    for (let i = floaters.length - 1; i >= 0; i--) {
      const f = floaters[i];
      f.y -= dt * 22;
      f.life -= dt * 0.9;
      if (f.life <= 0) floaters.splice(i, 1);
    }

    hudClock -= dt;
    if (hudClock <= 0) {
      hudClock = 0.25;
      writeHud();
    }
  }

  function writeHud() {
    if (hud.inspected) hud.inspected.textContent = inspected.toLocaleString('en-US');
    if (hud.blocked) hud.blocked.textContent = blocked.toLocaleString('en-US');
    if (hud.uptime) {
      const s = Math.floor((performance.now() - started) / 1000);
      hud.uptime.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
    }
  }

  function centre() {
    return { x: cx + tiltX * 0.4, y: cy + tiltY * 0.4 };
  }

  function draw() {
    const c = ctx!;
    c.clearRect(0, 0, w, h);
    const o = centre();

    // Range rings and ticks
    c.save();
    c.translate(o.x, o.y);
    c.strokeStyle = C.line;
    c.lineWidth = 1;
    for (const k of [0.58, 0.95, 1.18]) {
      c.globalAlpha = k === 1.18 ? 0.35 : 0.6;
      c.beginPath();
      c.ellipse(0, 0, R * k, R * k * 0.92, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.globalAlpha = 0.5;
    for (let a = 0; a < 72; a++) {
      const ang = (a / 72) * Math.PI * 2;
      const r1 = R * 1.18;
      const r2 = r1 + (a % 6 === 0 ? 9 : 4);
      c.beginPath();
      c.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1 * 0.92);
      c.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2 * 0.92);
      c.stroke();
    }

    // Radar sweep
    const grad = typeof c.createConicGradient === 'function' ? c.createConicGradient(sweep, 0, 0) : null;
    if (grad) {
      grad.addColorStop(0, 'rgba(76,214,255,0.22)');
      grad.addColorStop(0.08, 'rgba(76,214,255,0.0)');
      grad.addColorStop(1, 'rgba(76,214,255,0.0)');
      c.globalAlpha = 1;
      c.fillStyle = grad;
      c.beginPath();
      c.ellipse(0, 0, R * 1.18, R * 1.18 * 0.92, 0, 0, Math.PI * 2);
      c.fill();
    }
    c.globalAlpha = 0.8;
    c.strokeStyle = C.cyan;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(Math.cos(sweep) * R * 1.18, Math.sin(sweep) * R * 1.18 * 0.92);
    c.stroke();

    // Perimeter (dashed, rotating, flashes red on block)
    c.globalAlpha = 1;
    c.setLineDash([6, 8]);
    c.lineDashOffset = -sweep * 20;
    c.lineWidth = 1.5;
    c.strokeStyle = perimeterFlash > 0 ? C.red : C.green;
    c.shadowColor = perimeterFlash > 0 ? C.red : C.green;
    c.shadowBlur = 8 + perimeterFlash * 18;
    c.beginPath();
    c.arc(0, 0, perimeter(), 0, Math.PI * 2);
    c.stroke();
    c.setLineDash([]);
    c.shadowBlur = 0;
    c.restore();

    // Links
    c.lineWidth = 1;
    for (const n of nodes) {
      c.strokeStyle = n.ring === 0 ? 'rgba(76,214,255,0.22)' : 'rgba(76,214,255,0.12)';
      c.beginPath();
      c.moveTo(o.x, o.y);
      c.lineTo(n.x, n.y);
      c.stroke();
    }
    const inner = nodes.filter((n) => n.ring === 0);
    const outer = nodes.filter((n) => n.ring === 1);
    c.strokeStyle = 'rgba(76,214,255,0.1)';
    for (const n of outer) {
      let best = inner[0];
      let bd = Infinity;
      for (const m of inner) {
        const d = Math.hypot(m.x - n.x, m.y - n.y);
        if (d < bd) {
          bd = d;
          best = m;
        }
      }
      if (best) {
        c.beginPath();
        c.moveTo(n.x, n.y);
        c.lineTo(best.x, best.y);
        c.stroke();
      }
    }

    // Packets with short trails
    for (const p of packets) {
      const n = nodes[p.node];
      if (!n) continue;
      const t = p.inbound ? p.t : 1 - p.t;
      const tt = Math.max(0, p.inbound ? p.t - 0.12 : 1 - p.t + 0.12);
      const x = n.x + (o.x - n.x) * t;
      const y = n.y + (o.y - n.y) * t;
      const tx = n.x + (o.x - n.x) * Math.min(1, tt);
      const ty = n.y + (o.y - n.y) * Math.min(1, tt);
      c.strokeStyle = p.hue;
      c.globalAlpha = 0.35;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(x, y);
      c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = p.hue;
      c.shadowColor = p.hue;
      c.shadowBlur = 8;
      c.beginPath();
      c.arc(x, y, 2, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
    }

    // Threats
    for (const t of threats) {
      const x = cx + Math.cos(t.angle) * t.r + tiltX * 0.4 + Math.sin(t.wobble) * 2;
      const y = cy + Math.sin(t.angle) * t.r + tiltY * 0.4;
      const tx = cx + Math.cos(t.angle) * (t.r + 26) + tiltX * 0.4;
      const ty = cy + Math.sin(t.angle) * (t.r + 26) + tiltY * 0.4;
      const g = c.createLinearGradient(tx, ty, x, y);
      g.addColorStop(0, 'rgba(255,92,122,0)');
      g.addColorStop(1, 'rgba(255,92,122,0.8)');
      c.strokeStyle = g;
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(tx, ty);
      c.lineTo(x, y);
      c.stroke();
      c.save();
      c.translate(x, y);
      c.rotate(t.angle + Math.PI);
      c.fillStyle = C.red;
      c.shadowColor = C.red;
      c.shadowBlur = 12;
      c.beginPath();
      c.moveTo(5, 0);
      c.lineTo(-3, -3.5);
      c.lineTo(-3, 3.5);
      c.closePath();
      c.fill();
      c.restore();
    }

    // Nodes and labels
    c.font = `${compact ? 9.5 : 10.5}px "JetBrains Mono Variable", ui-monospace, monospace`;
    c.textBaseline = 'middle';
    for (const n of nodes) {
      const r = (n.ring === 0 ? 4 : 3.2) + n.glow * 2;
      c.fillStyle = n.ring === 0 ? C.cyan : C.green;
      c.shadowColor = c.fillStyle;
      c.shadowBlur = 10 + n.glow * 14;
      c.beginPath();
      c.arc(n.x, n.y, r, 0, Math.PI * 2);
      c.fill();
      c.shadowBlur = 0;
      const right = n.x >= o.x;
      c.textAlign = right ? 'left' : 'right';
      c.globalAlpha = 0.65 + n.glow * 0.35;
      c.fillStyle = n.glow > 0.3 ? C.ink : C.ink3;
      c.fillText(n.label, n.x + (right ? 9 : -9), n.y);
      c.globalAlpha = 1;
    }

    // Shield
    const s = R * 0.17;
    const pulse = 1 + Math.sin(performance.now() / 600) * 0.04;
    c.save();
    c.translate(o.x, o.y);
    c.scale(pulse, pulse);
    c.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * s;
      const py = Math.sin(a) * s;
      if (i === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fillStyle = 'rgba(15,27,43,0.95)';
    c.strokeStyle = C.cyan;
    c.lineWidth = 2;
    c.shadowColor = C.cyan;
    c.shadowBlur = 22;
    c.fill();
    c.stroke();
    c.shadowBlur = 0;
    c.fillStyle = C.ink;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `700 ${Math.max(12, s * 0.62)}px "Chakra Petch", system-ui, sans-serif`;
    c.fillText('AS', 0, 1);
    c.restore();

    // Sparks and BLOCKED labels
    for (const sp of sparks) {
      c.globalAlpha = Math.max(0, sp.life);
      c.fillStyle = C.red;
      c.fillRect(sp.x - 1, sp.y - 1, 2, 2);
    }
    c.font = `700 ${compact ? 9 : 10}px "JetBrains Mono Variable", ui-monospace, monospace`;
    c.textAlign = 'center';
    for (const f of floaters) {
      c.globalAlpha = Math.max(0, f.life);
      c.fillStyle = C.red;
      c.fillText('BLOCKED', f.x, f.y - 10);
    }
    c.globalAlpha = 1;
  }

  resize();

  const ro = new ResizeObserver(() => {
    resize();
    if (reduced) {
      update(0);
      draw();
    }
  });
  ro.observe(canvas);

  const onMove = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
  };
  const onLeave = () => {
    mouseX = -9999;
    mouseY = -9999;
  };

  if (reduced) {
    // One static, populated frame; no loop.
    for (let i = 0; i < 18; i++) {
      spawnPacket();
      packets[packets.length - 1].t = Math.random();
    }
    update(0);
    draw();
    writeHud();
    return () => ro.disconnect();
  }

  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);

  let raf = 0;
  let last = performance.now();
  let visible = true;
  let running = false;

  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(frame);
  };

  const start = () => {
    if (running || !visible || document.hidden) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  };
  const stop = () => {
    running = false;
    cancelAnimationFrame(raf);
  };

  const io = new IntersectionObserver((entries) => {
    visible = entries[0]?.isIntersecting ?? true;
    if (visible) start();
    else stop();
  });
  io.observe(canvas);

  const onVis = () => (document.hidden ? stop() : start());
  document.addEventListener('visibilitychange', onVis);

  start();

  return () => {
    stop();
    io.disconnect();
    ro.disconnect();
    document.removeEventListener('visibilitychange', onVis);
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerleave', onLeave);
  };
}
