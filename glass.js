import { Delaunay } from 'https://cdn.jsdelivr.net/npm/d3-delaunay@6/+esm';

const JEWELS = ['#e0245e', '#2b3fe0', '#1fa84f', '#ff8a1f', '#8a3cf0', '#13b9c9', '#ffd23f', '#ff5fa2', '#159bdc'];
const LEAD = '#141018';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Palettes taken from bright figurative windows: sunlit rays, cool blues, chrysanthemums, leaves. */
const SUN = ['#ffe14d', '#fff1a1', '#fffaf0', '#ffd23f', '#a8ecff', '#ffc6e6', '#fff7c2', '#ffb347'];
const COOL = ['#2733d6', '#4a2fc9', '#159bdc', '#7a35ee', '#c93bd0', '#13b9c9', '#3567ff', '#1d1f8f', '#e0307a'];
const LEAF = ['#0f7a35', '#24a148', '#5cc93b', '#9ee04a', '#0b5a2e', '#2fb36b', '#c8ea5a'];
const RIM = ['#d4143c', '#ff4f7b', '#ff7a3d', '#c2185b', '#ff9a3c', '#8e1fbf', '#ff3d6e'];
const PETALS = [
    [['#7a0f2a', '#b3122e', '#e0472a'], ['#d81f3a', '#f0542a', '#ff8a1f', '#e8283c'], ['#ff9f1c', '#ffc928', '#ffe25c', '#fff0b0', '#ff7b2e']],
    [['#6d0f3a', '#a3165a', '#c21f4a'], ['#e0307a', '#ff5fa2', '#f0542a'], ['#ffa3c8', '#ffd1e3', '#ffe25c', '#fff0f6']],
];
const PALETTE = [...SUN, ...COOL, ...LEAF.slice(0, 4), ...RIM.slice(0, 4)].map((c) => [c, 1]);

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function weighted() {
    const total = PALETTE.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [c, w] of PALETTE) if ((r -= w) <= 0) return c;
    return PALETTE[0][0];
}

function hexToHsl(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
}

function jewelHsl(hex, jitter = 0.07) {
    const [h, s, l] = hexToHsl(hex);
    const ll = Math.min(0.94, Math.max(0.2, l + rand(-jitter, jitter)));
    return `hsl(${(h + rand(-6, 6)).toFixed(1)} ${(Math.min(1, s * rand(0.95, 1.12)) * 100).toFixed(1)}% ${(ll * 100).toFixed(1)}%)`;
}

/* Grain for hand-blown glass. */
function makeNoise(size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const data = x.createImageData(size, size);
    for (let i = 0; i < data.data.length; i += 4) {
        const v = 128 + rand(-55, 55);
        data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
        data.data[i + 3] = 255;
    }
    x.putImageData(data, 0, 0);
    return c;
}

/* Wavy ripples like cathedral glass. */
function makeRipples(size = 256) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    x.fillStyle = '#808080';
    x.fillRect(0, 0, size, size);
    for (let i = 0; i < 160; i++) {
        const y = Math.random() * size, amp = rand(2, 9), f = rand(1, 3);
        x.strokeStyle = Math.random() < 0.55 ? `rgba(255,255,255,${rand(0.08, 0.3)})` : `rgba(0,0,0,${rand(0.06, 0.22)})`;
        x.lineWidth = rand(0.6, 3);
        x.beginPath();
        for (let px = 0; px <= size; px += 4) {
            const py = y + Math.sin((px / size) * Math.PI * 2 * f) * amp;
            px ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.stroke();
    }
    return c;
}

/* The window behind the whole page: sun rays, chrysanthemums and leaves, ringed by a leaded frame. */
class GlassWindow {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.noise = makeNoise();
        this.ripples = makeRipples();
        this.light = { x: 0.3, y: 0.3, active: false };
        this.hover = -1;
        this.sparkles = [];
        this.t = Math.random() * 100;
        this.bindEvents();
        new ResizeObserver(() => this.resize()).observe(canvas);
    }

    resize() {
        const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
        /* Mobile toolbars nudge the height while scrolling; only re-lead on real changes. */
        if (this.cssW === w && Math.abs((this.cssH || 0) - h) < 160) return;
        this.cssW = w; this.cssH = h;
        this.build();
    }

    layoutFlowers(w, h, small) {
        const spots = small
            ? [[0.02, 0.12, 0.42], [0.98, 0.5, 0.36], [0.1, 0.9, 0.4]]
            : [[0.1, 0.32, 0.27], [0.2, 0.9, 0.19], [0.9, 0.82, 0.24], [0.88, 0.1, 0.14]];
        const minDim = Math.min(w, h);
        return spots.map(([fx, fy, fr], i) => ({
            x: (fx + rand(-0.03, 0.03)) * w,
            y: (fy + rand(-0.03, 0.03)) * h,
            r: fr * minDim * rand(0.9, 1.1),
            petals: PETALS[i === 2 ? 1 : 0],
            spin: rand(0, Math.PI * 2),
        }));
    }

    build() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
        if (!w || !h) return;
        this.canvas.width = w; this.canvas.height = h;
        this.w = w; this.h = h; this.dpr = dpr;

        const small = window.innerWidth < 600;
        const cx = w / 2, cy = h * 0.42;
        this.center = [cx, cy];
        this.rim = (Math.hypot(w, h) / 2) * (small ? 0.96 : 0.9);
        const flowers = this.flowers = this.layoutFlowers(w, h, small);

        const points = [], meta = [];
        const add = (x, y, m) => { points.push([x, y]); meta.push(m); };
        const inFlower = (x, y, pad) => flowers.some((f) => Math.hypot(x - f.x, y - f.y) < f.r * pad);

        /* Two bands of noise decide where rays run warm (sunlight) or cool (sky). */
        const p1 = rand(0, 6), p2 = rand(0, 6);
        const rays = small ? 70 : 120;
        for (let i = 0; i < rays; i++) {
            const a = ((i + rand(-0.2, 0.2)) / rays) * Math.PI * 2;
            const warm = Math.sin(a * 3 + p1) + 0.6 * Math.sin(a * 5 + p2) > -0.1;
            for (let r = rand(20, 60) * dpr; r < this.rim * 1.02; r += (rand(70, 130) + r / dpr * 0.22) * dpr) {
                const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
                if (inFlower(x, y, 1.5)) continue;
                const family = Math.random() < 0.12 ? (warm ? COOL : SUN) : (warm ? SUN : COOL);
                add(x, y, { kind: 'ray', color: family, a });
            }
        }

        for (const f of flowers) {
            const rings = 5;
            add(f.x, f.y, { kind: 'petal', f, t: 0 });
            for (let k = 1; k < rings; k++) {
                const t = k / (rings - 1);
                const rr = f.r * (0.12 + 0.88 * Math.pow(t, 0.85));
                const n = Math.max(7, Math.round((Math.PI * 2 * rr) / (f.r * 0.13)));
                for (let j = 0; j < n; j++) {
                    const a = f.spin + ((j + (k % 2) * 0.5 + rand(-0.12, 0.12)) / n) * Math.PI * 2;
                    add(f.x + Math.cos(a) * rr, f.y + Math.sin(a) * rr, { kind: 'petal', f, t });
                }
            }
            const leafCell = (small ? 30 : 40) * dpr;
            const count = Math.round((Math.PI * (2.25 - 1.15) * f.r * f.r) / (leafCell * leafCell));
            for (let j = 0; j < count; j++) {
                const a = rand(0, Math.PI * 2), rr = f.r * Math.sqrt(rand(1.15, 2.25));
                const x = f.x + Math.cos(a) * rr, y = f.y + Math.sin(a) * rr;
                if (flowers.some((g) => g !== f && Math.hypot(x - g.x, y - g.y) < g.r * 1.1)) continue;
                add(x, y, { kind: 'leaf', f });
            }
        }

        this.points = points;
        this.meta = meta;
        this.delaunay = Delaunay.from(points);
        this.voronoi = this.delaunay.voronoi([0, 0, w, h]);
        this.base = meta.map((m) => {
            if (m.kind === 'ray') return jewelHsl(pick(m.color), 0.06);
            if (m.kind === 'leaf') return jewelHsl(pick(LEAF), 0.06);
            const band = m.t < 0.3 ? 0 : m.t < 0.8 ? 1 : 2;
            return jewelHsl(pick(m.f.petals[band]), 0.05);
        });
        this.rimColors = Array.from({ length: 16 }, () => jewelHsl(pick(RIM), 0.06));
        this.colors = this.base.slice();
        this.flash = new Float32Array(points.length);
        this.sparkles = [];
        this.renderLayers();
        if (!this.running) this.loop();
    }

    renderLayers() {
        const { w, h, dpr } = this;
        const [cx, cy] = this.center;
        const far = Math.hypot(w, h);
        this.glass = this.glass || document.createElement('canvas');
        this.leadLayer = this.leadLayer || document.createElement('canvas');
        for (const c of [this.glass, this.leadLayer]) { c.width = w; c.height = h; }

        const g = this.glass.getContext('2d');
        g.save();
        g.beginPath();
        g.arc(cx, cy, this.rim, 0, Math.PI * 2);
        g.clip();
        for (let i = 0; i < this.colors.length; i++) {
            const m = this.meta[i];
            g.beginPath();
            this.voronoi.renderCell(i, g);
            g.fillStyle = this.colors[i];
            g.fill();
            let grad;
            if (m.kind === 'petal') {
                grad = g.createRadialGradient(m.f.x, m.f.y, 0, m.f.x, m.f.y, m.f.r * 1.05);
                grad.addColorStop(0, 'rgba(0,0,0,0.3)');
                grad.addColorStop(0.6, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(255,255,255,0.3)');
            } else {
                const [x0, y0, x1, y1] = this.cellBounds(i);
                const flip = Math.random() < 0.5;
                grad = g.createLinearGradient(flip ? x1 : x0, y0, flip ? x0 : x1, y1);
                grad.addColorStop(0, 'rgba(255,255,255,0.28)');
                grad.addColorStop(0.5, 'rgba(255,255,255,0)');
                grad.addColorStop(1, 'rgba(0,0,0,0.16)');
            }
            g.fillStyle = grad;
            g.fill();
            if (this.flash[i] > 0) {
                g.fillStyle = `rgba(255,255,240,${this.flash[i] * 0.65})`;
                g.fill();
            }
        }
        g.restore();

        const spokes = this.rimColors.length;
        for (let j = 0; j < spokes; j++) {
            const a0 = (j / spokes) * Math.PI * 2, a1 = ((j + 1) / spokes) * Math.PI * 2;
            g.beginPath();
            g.arc(cx, cy, this.rim, a0, a1);
            g.arc(cx, cy, far, a1, a0, true);
            g.closePath();
            g.fillStyle = this.rimColors[j];
            g.fill();
            const grad = g.createRadialGradient(cx, cy, this.rim, cx, cy, far * 0.62);
            grad.addColorStop(0, 'rgba(255,255,255,0.3)');
            grad.addColorStop(1, 'rgba(0,0,0,0.25)');
            g.fillStyle = grad;
            g.fill();
        }

        g.globalCompositeOperation = 'overlay';
        g.globalAlpha = 0.28;
        g.fillStyle = g.createPattern(this.noise, 'repeat');
        g.fillRect(0, 0, w, h);
        const ripple = g.createPattern(this.ripples, 'repeat');
        ripple.setTransform(new DOMMatrix().rotate(-28).scale(dpr));
        g.globalAlpha = 0.45;
        g.fillStyle = ripple;
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;

        const l = this.leadLayer.getContext('2d');
        l.save();
        l.beginPath();
        l.arc(cx, cy, this.rim, 0, Math.PI * 2);
        l.clip();
        l.beginPath();
        this.voronoi.render(l);
        l.strokeStyle = LEAD;
        l.lineWidth = 2.2 * dpr;
        l.lineJoin = 'round';
        l.stroke();
        l.restore();
        l.strokeStyle = LEAD;
        l.lineCap = 'butt';
        l.lineWidth = 14 * dpr;
        l.beginPath();
        l.arc(cx, cy, this.rim, 0, Math.PI * 2);
        l.stroke();
        l.beginPath();
        for (let j = 0; j < spokes; j++) {
            const a = (j / spokes) * Math.PI * 2;
            l.moveTo(cx + Math.cos(a) * this.rim, cy + Math.sin(a) * this.rim);
            l.lineTo(cx + Math.cos(a) * far, cy + Math.sin(a) * far);
        }
        l.stroke();
    }

    cellBounds(i) {
        const poly = this.voronoi.cellPolygon(i);
        if (!poly) return [0, 0, 1, 1];
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const [x, y] of poly) {
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        }
        return [x0, y0, x1, y1];
    }

    insideRim(x, y) {
        return Math.hypot(x - this.center[0], y - this.center[1]) < this.rim - 7 * this.dpr;
    }

    addSparkle(x, y, opts = {}) {
        if (this.sparkles.length > 160) return;
        this.sparkles.push({
            x, y,
            vx: opts.vx || 0, vy: opts.vy || 0,
            life: 0,
            max: opts.max || rand(40, 90),
            size: (opts.size || rand(5, 14)) * this.dpr,
            rot: rand(0, Math.PI / 4),
            hue: pick([48, 55, 190, 320, 0, 280]),
        });
    }

    /* Glints catch where the lead lines meet, and more often near the light. */
    spawnAmbient() {
        const cc = this.voronoi.circumcenters;
        const tries = this.light.active ? 2 : 1;
        for (let k = 0; k < tries; k++) {
            if (Math.random() > 0.55) continue;
            let x, y;
            if (Math.random() < 0.5) {
                const ang = rand(0, Math.PI * 2), d = rand(0, Math.max(this.w, this.h) * 0.22);
                x = this.light.x * this.w + Math.cos(ang) * d;
                y = this.light.y * this.h + Math.sin(ang) * d;
            } else {
                const i = Math.floor(Math.random() * (cc.length / 2));
                x = cc[i * 2]; y = cc[i * 2 + 1];
            }
            if (x >= 0 && y >= 0 && x <= this.w && y <= this.h) this.addSparkle(x, y);
        }
    }

    drawSparkles() {
        const { ctx } = this;
        ctx.globalCompositeOperation = 'lighter';
        this.sparkles = this.sparkles.filter((s) => s.life < s.max);
        for (const s of this.sparkles) {
            s.life++;
            s.x += s.vx; s.y += s.vy;
            s.vx *= 0.94; s.vy *= 0.94;
            const a = Math.sin((s.life / s.max) * Math.PI);
            const r = s.size * (0.6 + 0.4 * a);
            const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 1.8);
            glow.addColorStop(0, `hsla(${s.hue} 100% 85% / ${0.55 * a})`);
            glow.addColorStop(1, `hsla(${s.hue} 100% 70% / 0)`);
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(s.x, s.y, r * 1.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.save();
            ctx.translate(s.x, s.y);
            ctx.rotate(s.rot + s.life * 0.01);
            ctx.fillStyle = `rgba(255,255,255,${a})`;
            for (const [scale, turn] of [[1, 0], [0.5, Math.PI / 4]]) {
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const ang = turn + (i / 8) * Math.PI * 2;
                    const rr = i % 2 ? r * scale * 0.16 : r * scale;
                    ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
                }
                ctx.closePath();
                ctx.fill();
            }
            ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    draw() {
        const { ctx, w, h } = this;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(this.glass, 0, 0);
        ctx.fillStyle = 'rgba(10, 8, 20, 0.06)';
        ctx.fillRect(0, 0, w, h);

        const lx = this.light.x * w, ly = this.light.y * h;
        ctx.globalCompositeOperation = 'screen';
        const radius = Math.max(w, h) * (this.light.active ? 0.26 : 0.36);
        const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius);
        glow.addColorStop(0, 'rgba(255,246,220,0.55)');
        glow.addColorStop(0.35, 'rgba(255,238,200,0.18)');
        glow.addColorStop(1, 'rgba(255,238,200,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);

        /* A sheen of light sweeps across the glass every few seconds. */
        if (!reduceMotion) {
            const s = (this.t * 0.7) % 1;
            const band = Math.max(w, h) * 0.12;
            const x = -0.3 * w + s * 1.6 * w;
            ctx.save();
            ctx.translate(w / 2, h / 2);
            ctx.rotate(0.38);
            ctx.translate(-w / 2, -h / 2);
            const sheen = ctx.createLinearGradient(x - band, 0, x + band, 0);
            sheen.addColorStop(0, 'rgba(255,255,255,0)');
            sheen.addColorStop(0.5, 'rgba(255,255,255,0.22)');
            sheen.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = sheen;
            ctx.fillRect(-w, -h, w * 3, h * 3);
            ctx.restore();
        }

        if (this.hover >= 0) {
            ctx.beginPath();
            this.voronoi.renderCell(this.hover, ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.35)';
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(this.leadLayer, 0, 0);
        this.drawSparkles();
    }

    loop() {
        this.running = true;
        if (reduceMotion) {
            for (let i = 0; i < 30; i++) this.spawnAmbient();
            this.sparkles.forEach((s) => { s.life = s.max / 2; s.max = Infinity; });
        }
        const tick = () => {
            this.t += 0.003;
            if (!this.light.active && !reduceMotion) {
                this.light.x = 0.5 + Math.sin(this.t * 1.3) * 0.45;
                this.light.y = 0.45 + Math.sin(this.t * 0.9 + 1) * 0.35;
            }
            if (!reduceMotion) this.spawnAmbient();
            let dirty = false;
            for (let i = 0; i < this.flash.length; i++) {
                if (this.flash[i] > 0) { this.flash[i] = Math.max(0, this.flash[i] - 0.04); dirty = true; }
            }
            if (dirty) this.renderLayers();
            this.draw();
            requestAnimationFrame(tick);
        };
        tick();
    }

    toLocal(e) {
        const r = this.canvas.getBoundingClientRect();
        return [(e.clientX - r.left) * this.dpr, (e.clientY - r.top) * this.dpr];
    }

    bindEvents() {
        window.addEventListener('pointermove', (e) => {
            if (!this.delaunay || e.pointerType === 'touch') return;
            const [x, y] = this.toLocal(e);
            this.light = { x: x / this.w, y: y / this.h, active: true };
            this.hover = e.target === this.canvas && this.insideRim(x, y) ? this.delaunay.find(x, y) : -1;
            if (!reduceMotion && Math.random() < 0.35) {
                this.addSparkle(x + rand(-14, 14) * this.dpr, y + rand(-14, 14) * this.dpr, { size: rand(4, 9), max: rand(25, 45) });
            }
        });
        document.addEventListener('pointerleave', () => {
            this.light.active = false;
            this.hover = -1;
        });
        this.canvas.addEventListener('click', (e) => {
            if (!this.delaunay) return;
            const [x, y] = this.toLocal(e);
            if (!reduceMotion) {
                for (let i = 0; i < 18; i++) {
                    const a = rand(0, Math.PI * 2), v = rand(1, 5) * this.dpr;
                    this.addSparkle(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rand(5, 12), max: rand(30, 60) });
                }
            }
            if (this.insideRim(x, y)) this.spread(this.delaunay.find(x, y));
        });
    }

    /* Recolor a pane, then let the color ripple outward through its neighbors. */
    spread(start) {
        const jewel = pick(JEWELS);
        const seen = new Set([start]);
        let ring = [start];
        for (let depth = 0; depth < 3 && ring.length; depth++) {
            const current = ring;
            setTimeout(() => {
                for (const i of current) {
                    if (depth === 0 || Math.random() < 0.7) {
                        this.colors[i] = jewelHsl(jewel, 0.1);
                        this.flash[i] = 1 - depth * 0.25;
                    }
                }
                this.renderLayers();
            }, reduceMotion ? 0 : depth * 90);
            const next = [];
            for (const i of current) {
                for (const j of this.delaunay.neighbors(i)) {
                    if (!seen.has(j)) { seen.add(j); next.push(j); }
                }
            }
            ring = next;
        }
    }

    reset() {
        this.colors = this.base.slice();
        this.renderLayers();
    }
}

/* A small rose window used as the logo mark and favicon. */
function roseSvg(size = 18) {
    const petals = 8, c = 50;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">`;
    s += `<circle cx="${c}" cy="${c}" r="47" fill="${JEWELS[1]}" stroke="${LEAD}" stroke-width="5"/>`;
    for (let i = 0; i < petals; i++) {
        const a = (i / petals) * Math.PI * 2;
        const px = c + Math.cos(a) * 28, py = c + Math.sin(a) * 28;
        s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="15" fill="${JEWELS[[0, 3, 2, 6, 7, 5, 4, 3][i]]}" stroke="${LEAD}" stroke-width="4"/>`;
    }
    s += `<circle cx="${c}" cy="${c}" r="13" fill="${JEWELS[6]}" stroke="${LEAD}" stroke-width="4"/></svg>`;
    return s;
}

function addRose() {
    const home = document.querySelector('.header-links a[href="/"]');
    if (home) {
        const mark = document.createElement('span');
        mark.className = 'rose';
        mark.innerHTML = roseSvg();
        home.prepend(mark);
    }
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = 'data:image/svg+xml,' + encodeURIComponent(roseSvg(64));
}

/* Colored light from the window falling across the clear pane in the middle. */
function addCastLight() {
    const pane = document.querySelector('.container');
    if (!pane) return;
    const field = document.createElement('div');
    field.className = 'light-field';
    field.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 5; i++) {
        const spot = document.createElement('span');
        spot.style.setProperty('--c', JEWELS[(i * 3) % JEWELS.length]);
        spot.style.setProperty('--x', `${rand(-20, 70)}%`);
        spot.style.setProperty('--y', `${rand(-10, 80)}%`);
        spot.style.setProperty('--s', `${rand(260, 420)}px`);
        spot.style.setProperty('--d', `${rand(24, 40)}s`);
        spot.style.animationDelay = `${-rand(0, 40)}s`;
        field.appendChild(spot);
    }
    pane.prepend(field);

    const twinkles = document.createElement('div');
    twinkles.className = 'twinkles';
    twinkles.setAttribute('aria-hidden', 'true');
    const n = window.innerWidth < 600 ? 8 : 14;
    for (let i = 0; i < n; i++) {
        const star = document.createElement('span');
        const edge = i % 4;
        const along = rand(4, 96);
        const inset = rand(1.5, 5);
        star.style.left = `${edge === 0 ? inset : edge === 1 ? 100 - inset : along}%`;
        star.style.top = `${edge === 2 ? inset + 6 : edge === 3 ? 100 - inset : along}%`;
        star.style.setProperty('--c', pick(['#ffb020', '#ff4f9a', '#13b9c9', '#8a3cf0', '#ffd23f', '#2b8fe0']));
        star.style.setProperty('--s', `${rand(11, 20)}px`);
        star.style.animationDuration = `${rand(2.4, 4.8)}s`;
        star.style.animationDelay = `${-rand(0, 5)}s`;
        twinkles.appendChild(star);
    }
    pane.prepend(twinkles);
}

/* A thin leaded strip of glass under each section heading. */
function addCames() {
    document.querySelectorAll('.section-label').forEach((label) => {
        const strip = document.createElement('span');
        strip.className = 'came';
        strip.setAttribute('aria-hidden', 'true');
        const n = 5 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
            const pane = document.createElement('i');
            pane.style.flexGrow = rand(0.6, 2).toFixed(2);
            pane.style.background = jewelHsl(weighted(), 0.05);
            strip.appendChild(pane);
        }
        label.appendChild(strip);
    });
}

addRose();
addCastLight();
addCames();

const bg = document.querySelector('.glass-bg');
if (bg) {
    const win = new GlassWindow(bg);
    document.querySelector('[data-action="relead"]')?.addEventListener('click', () => win.build());
    document.querySelector('[data-action="reset"]')?.addEventListener('click', () => win.reset());
}
