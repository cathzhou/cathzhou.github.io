import { Delaunay } from 'https://cdn.jsdelivr.net/npm/d3-delaunay@6/+esm';

const JEWELS = ['#e0245e', '#2b3fe0', '#1fa84f', '#ff8a1f', '#8a3cf0', '#13b9c9', '#ffd23f', '#ff5fa2', '#159bdc'];
const LEAD = '#141018';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* Palettes taken from the reference window. */
const RAY = [['#fffaf0', 3], ['#fff3c4', 3], ['#fde68a', 2], ['#f9d342', 1.2], ['#cfeefa', 1.5], ['#a7dcf2', 1], ['#fbe3b0', 1.2], ['#e9f6c8', 0.8], ['#f7c6d6', 0.35]];
const RAY_WARM = [['#fde68a', 2], ['#f9d342', 2], ['#ffe9a6', 2], ['#fff3c4', 2], ['#f6b93b', 0.6]];
const FACE = ['#1e2a8a', '#2b3fe0', '#3f6ee8', '#5a8ff0', '#7fb3f5', '#a9d4f7', '#6a4fc8', '#8a6fe0', '#4a2fb0', '#b9a6f0', '#dfe8f7', '#3fb6d9'];
const FACE_ACCENT = ['#e8318a', '#ffd23f', '#f59fc2', '#ffe9a6', '#ff5fa2'];
const WARM_FLOWER = { base: ['#b5122b', '#d81f26', '#7a1f1a', '#e2462a', '#f47b20', '#5a1a12', '#d81f26'], tip: ['#ffd93b', '#fff1c9', '#f9a825', '#f47b20', '#ffe36e', '#ffd93b', '#f25c78'] };
const PINK_FLOWER = { base: ['#c2185b', '#e0307a', '#9b2a6a', '#d81f26'], tip: ['#ffd1e0', '#ff8fb3', '#fff1c9', '#ffd93b'] };
const LEAF = ['#0f5e2a', '#1d7a32', '#2e9a3a', '#4cb848', '#7fd03b', '#b0e04a', '#d6ec5a'];
const BORDER = ['#d81f26', '#e2462a', '#f47b20', '#c41e3a', '#e8457a', '#ff8fb3', '#ffd23f', '#b5122b', '#f9a03f'];
const BORDER_COOL = ['#2a5fe1', '#3f8ae8', '#6a4fc8', '#ff8fb3'];
const PALETTE = [...BORDER, ...LEAF.slice(2), ...FACE.slice(1, 8)].map((c) => [c, 1]);

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const polar = ([cx, cy], a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];

function weightedFrom(list) {
    const total = list.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    for (const [c, w] of list) if ((r -= w) <= 0) return c;
    return list[0][0];
}
const weighted = () => weightedFrom(PALETTE);

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
    const ll = Math.min(0.96, Math.max(0.12, l + rand(-jitter, jitter)));
    return `hsl(${(h + rand(-6, 6)).toFixed(1)} ${(Math.min(1, s * rand(0.95, 1.12)) * 100).toFixed(1)}% ${(ll * 100).toFixed(1)}%)`;
}

/* Grain for hand-blown glass. */
function makeNoise(size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const data = x.createImageData(size, size);
    for (let i = 0; i < data.data.length; i += 4) {
        const v = 128 + rand(-60, 60);
        data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
        data.data[i + 3] = 255;
    }
    x.putImageData(data, 0, 0);
    return c;
}

/* Soft blotches, like the mottling in painted glass. */
function makeMottle(size = 512) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = true;
    for (const [cells, alpha] of [[10, 1], [28, 0.6], [70, 0.35]]) {
        const s = document.createElement('canvas');
        s.width = s.height = cells;
        const sx = s.getContext('2d');
        const data = sx.createImageData(cells, cells);
        for (let i = 0; i < data.data.length; i += 4) {
            const v = 128 + rand(-70, 70);
            data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
            data.data[i + 3] = 255;
        }
        sx.putImageData(data, 0, 0);
        x.globalAlpha = alpha;
        x.drawImage(s, 0, 0, size, size);
    }
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

function polyPath(poly) {
    const p = new Path2D();
    poly.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
    p.closePath();
    return p;
}

/*
 * The window behind the whole page, after "Impressionable": a great roundel ringed in heavy lead with warm panes
 * between thick spokes outside it; inside, pale rays stream out from behind the text, chrysanthemums and leaves
 * crowd the left, and faceted blue-violet glass sits on the right.
 */
class GlassWindow {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.noise = makeNoise();
        this.mottle = makeMottle();
        this.ripples = makeRipples();
        this.light = { x: 0.22, y: 0.2, active: hasMouse };
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

    build() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
        if (!w || !h) return;
        this.canvas.width = w; this.canvas.height = h;
        this.w = w; this.h = h; this.dpr = dpr;

        const small = window.innerWidth < 600;
        const S = Math.min(w, h * 1.6);
        const C = [w / 2, h / 2];
        const R = Math.min(Math.max(w, h) * 0.5, Math.hypot(w, h) * 0.44);
        const far = Math.hypot(w, h);
        const circle = new Path2D();
        circle.arc(C[0], C[1], R, 0, Math.PI * 2);
        const inCircle = (x, y) => Math.hypot(x - C[0], y - C[1]) < R;
        const onScreen = (x, y) => x > -10 && y > -10 && x < w + 10 && y < h + 10;
        const pieces = [];
        const add = (p) => {
            p.path = p.path || polyPath(p.poly);
            pieces.push(p);
        };

        /* Rays: long pale streaks flowing out from behind the text, each one waving a little. */
        const F = [w * 0.55, h * 0.42];
        const bounds = [];
        for (let a = rand(0, 0.05); a < Math.PI * 2 - 0.03; a += rand(0.025, 0.065)) {
            bounds.push({ a, k: rand(0.004, 0.01) / dpr, ph: rand(0, 6.3), amp: rand(0.015, 0.05) });
        }
        const bend = (b, r) => b.a + Math.sin(r * b.k + b.ph) * b.amp * Math.min(1, r / (120 * dpr));
        for (let i = 0; i < bounds.length; i++) {
            const b0 = bounds[i], b1 = bounds[(i + 1) % bounds.length];
            const wrap = i === bounds.length - 1 ? Math.PI * 2 : 0;
            for (let r = rand(10, 40) * dpr; r < far; ) {
                const r1 = r + rand(70, 240) * dpr * (0.6 + r / R);
                const poly = [];
                for (let q = r; q < r1; q += 14 * dpr) poly.push(polar(F, bend(b0, q), q));
                poly.push(polar(F, bend(b0, r1), r1));
                for (let q = r1; q > r; q -= 14 * dpr) poly.push(polar(F, bend(b1, q) + wrap, q));
                poly.push(polar(F, bend(b1, r) + wrap, r));
                if (poly.some(([x, y]) => inCircle(x, y) && onScreen(x, y))) {
                    const [mx, my] = poly[Math.floor(poly.length / 4)];
                    const warm = my < F[1] - h * 0.12 || Math.random() < 0.15;
                    add({ poly, fill: jewelHsl(weightedFrom(warm ? RAY_WARM : RAY), 0.03), clips: [circle], lead: 1.5 });
                }
                r = r1;
            }
        }

        /* Faceted blue-violet glass on the right, like the face in the reference, outlined in one smooth line. */
        const face = small
            ? { x: w * 1.02, y: h * 0.55, rx: w * 0.32, ry: h * 0.28 }
            : { x: w * 0.92, y: h * 0.54, rx: w * 0.16, ry: h * 0.42 };
        const faceClip = new Path2D();
        faceClip.ellipse(face.x, face.y, face.rx, face.ry, 0, 0, Math.PI * 2);
        const fs = (small ? 44 : 62) * dpr;
        const seeds = [];
        for (let y = face.y - face.ry; y < face.y + face.ry + fs; y += fs * 0.8) {
            for (let x = face.x - face.rx; x < face.x + face.rx + fs; x += fs * rand(0.7, 1.4)) {
                seeds.push([x + rand(-0.4, 0.4) * fs, y + rand(-0.4, 0.4) * fs]);
            }
        }
        /* Triangulate rather than tile, so the pieces come out as angular shards. */
        const fd = Delaunay.from(seeds);
        for (let i = 0; i < fd.triangles.length / 3; i++) {
            const poly = fd.trianglePolygon(i);
            const sx = (poly[0][0] + poly[1][0] + poly[2][0]) / 3, sy = (poly[0][1] + poly[1][1] + poly[2][1]) / 3;
            const inside = ((sx - face.x) / face.rx) ** 2 + ((sy - face.y) / face.ry) ** 2 < 1.15;
            if (!inside || !poly.some(([x, y]) => inCircle(x, y) && onScreen(x, y))) continue;
            /* Deeper violet to the lower left, paler blue to the upper right, with a few bright accents. */
            const t = Math.min(1, Math.max(0, 0.5 + ((sx - face.x) / face.rx) * 0.35 - ((sy - face.y) / face.ry) * 0.35 + rand(-0.3, 0.3)));
            const c = Math.random() < 0.08 ? pick(FACE_ACCENT) : FACE[Math.min(FACE.length - 1, Math.floor(t * FACE.length))];
            add({ poly: poly.slice(0, -1), fill: jewelHsl(c, 0.05), clips: [circle, faceClip], lead: 1.6 });
        }
        const outlines = [{ path: faceClip, width: 5, clip: circle }];

        /* Leaves: two halves split by a leaded midrib, dark at the stem and bright at the tip. */
        const leaf = (bx, by, a, L, W) => {
            const tx = bx + Math.cos(a) * L, ty = by + Math.sin(a) * L;
            const mx = bx + Math.cos(a) * L * 0.45, my = by + Math.sin(a) * L * 0.45;
            const nx = -Math.sin(a), ny = Math.cos(a);
            for (const side of [1, -1]) {
                const cx = mx + nx * W * side * 1.3, cy = my + ny * W * side * 1.3;
                const path = new Path2D();
                path.moveTo(bx, by);
                path.quadraticCurveTo(cx, cy, tx, ty);
                path.closePath();
                const dark = side < 0 ? 0 : 1;
                add({
                    path,
                    poly: [[bx, by], [mx + nx * W * side * 0.65, my + ny * W * side * 0.65], [tx, ty]],
                    fill: { from: [bx, by], to: [tx, ty], c0: jewelHsl(LEAF[dark], 0.04), c1: jewelHsl(LEAF[4 + dark + Math.floor(rand(0, 1.99))], 0.05) },
                    clips: [circle], lead: 1.8,
                });
            }
        };

        /* Chrysanthemums: rings of curled petals, outermost first, each petal shading from its base to its tip. */
        const flower = (cx, cy, Rf, pal) => {
            const sy = rand(0.8, 1), rot = rand(0, Math.PI * 2), swirl = pick([-1, 1]) * rand(0.15, 0.3);
            const P = (a, r) => {
                const x = Math.cos(a) * r, y = Math.sin(a) * r * sy;
                return [cx + x * Math.cos(rot) - y * Math.sin(rot), cy + x * Math.sin(rot) + y * Math.cos(rot)];
            };
            for (let k = 0; k < 9; k++) {
                const a = rand(0, Math.PI * 2);
                leaf(...P(a, Rf * 0.5), a + rot + rand(-0.3, 0.3), Rf * rand(0.9, 1.4), Rf * rand(0.22, 0.32));
            }
            const rings = 8;
            for (let j = 0; j < rings; j++) {
                const f = 1 - j / (rings + 0.5);
                const r1 = Rf * f, r0 = Rf * f * 0.42;
                const n = Math.round(9 + 11 * f);
                const hw = (Math.PI / n) * 1.55;
                const off = rand(0, Math.PI * 2);
                for (let i = 0; i < n; i++) {
                    const a = off + (i / n) * Math.PI * 2 + rand(-0.08, 0.08);
                    const curl = swirl * (0.6 + f);
                    const rm = r0 + (r1 - r0) * 0.6;
                    const bl = P(a - hw * 0.3, r0), br = P(a + hw * 0.3, r0), tip = P(a + curl, r1 * rand(0.92, 1.05));
                    const cl = P(a - hw, rm), cr = P(a + hw, rm);
                    const path = new Path2D();
                    path.moveTo(...bl);
                    path.quadraticCurveTo(...cl, ...tip);
                    path.quadraticCurveTo(...cr, ...br);
                    path.closePath();
                    const inner = j >= rings - 2;
                    add({
                        path,
                        poly: [bl, P(a - hw * 0.5, rm), tip, P(a + hw * 0.5, rm), br],
                        fill: {
                            from: P(a, r0), to: tip,
                            c0: jewelHsl(pick(pal.base), 0.05),
                            c1: jewelHsl(inner && Math.random() < 0.5 ? pick(pal.base) : pick(pal.tip), 0.05),
                        },
                        clips: [circle], lead: 1.6,
                    });
                }
            }
            const disc = Rf * 0.13;
            const core = new Path2D();
            core.ellipse(cx, cy, disc, disc * sy, rot, 0, Math.PI * 2);
            add({ path: core, poly: [P(0, disc), P(2.1, disc), P(4.2, disc)], fill: jewelHsl('#4a1c10', 0.04), clips: [circle], lead: 1.6 });
            for (let i = 0; i < 7; i++) {
                const [x, y] = P(rand(0, Math.PI * 2), disc * rand(0, 0.65));
                const r = disc * rand(0.16, 0.24);
                const seed = new Path2D();
                seed.arc(x, y, r, 0, Math.PI * 2);
                add({ path: seed, poly: [[x - r, y], [x, y - r], [x + r, y], [x, y + r]], fill: jewelHsl('#9a948a', 0.08), clips: [circle], lead: 1 });
            }
        };

        const blooms = small
            ? [[0.08, 0.07, 0.3, WARM_FLOWER], [0.02, 0.36, 0.22, WARM_FLOWER], [0.12, 0.95, 0.26, WARM_FLOWER], [0.95, 0.92, 0.2, PINK_FLOWER]]
                .map(([x, y, r, p]) => [x, y, r * w, p])
            : [[0.1, 0.22, 0.135, WARM_FLOWER], [0.06, 0.6, 0.125, WARM_FLOWER], [0.2, 0.93, 0.095, WARM_FLOWER], [0.22, 0.04, 0.07, PINK_FLOWER], [0.9, 0.93, 0.08, PINK_FLOWER]]
                .map(([x, y, r, p]) => [x, y, r * S, p]);
        for (let k = 0; k < (small ? 6 : 14); k++) {
            const [fx, fy, fr] = pick(blooms.slice(0, 3));
            const a = rand(0, Math.PI * 2);
            leaf(fx * w + Math.cos(a) * fr * 0.9, fy * h + Math.sin(a) * fr * 0.9, a + rand(-0.6, 0.6), fr * rand(0.7, 1.2), fr * rand(0.2, 0.3));
        }
        for (const [fx, fy, fr, pal] of blooms) flower(fx * w, fy * h, fr, pal);

        /* Outside the roundel: big warm panes between heavy spokes. */
        const nb = small ? 12 : 16, step = (Math.PI * 2) / nb, off = rand(0, step);
        const spokes = [];
        let last = '';
        for (let k = 0; k < nb; k++) {
            const a0 = off + k * step, a1 = a0 + step, am = (a0 + a1) / 2;
            spokes.push(a0);
            const poly = [];
            for (let q = 0; q <= 8; q++) poly.push(polar(C, a0 + (q / 8) * step, R));
            poly.push(polar(C, a1, far * 1.5), polar(C, a0, far * 1.5));
            const cool = Math.sin(am) < -0.35 && Math.cos(am) > 0.15;
            let c;
            do c = pick(cool ? BORDER_COOL : BORDER); while (c === last);
            last = c;
            add({ poly, fill: jewelHsl(c, 0.06), lead: 2 });
        }

        this.pieces = pieces;
        this.deco = { C, R, far, spokes, outlines, lead: Math.max(9 * dpr, R * 0.028) };
        this.base = pieces.map((p) => p.fill);
        this.colors = this.base.slice();
        this.buildGrid();
        this.sparkles = [];
        this.renderGlass();
        if (!this.running) this.loop();
    }

    /* A coarse grid of piece indices for picking the piece under a point. */
    buildGrid() {
        const cell = this.cell = 64 * this.dpr;
        const grid = this.grid = new Map();
        this.pieces.forEach((p, i) => {
            let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            for (const [x, y] of p.poly) {
                x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
            }
            const pad = Math.max(x1 - x0, y1 - y0) * 0.15;
            p.cx = (x0 + x1) / 2; p.cy = (y0 + y1) / 2;
            const gx0 = Math.max(0, Math.floor((x0 - pad) / cell)), gx1 = Math.min(Math.ceil(this.w / cell), Math.floor((x1 + pad) / cell));
            const gy0 = Math.max(0, Math.floor((y0 - pad) / cell)), gy1 = Math.min(Math.ceil(this.h / cell), Math.floor((y1 + pad) / cell));
            for (let gx = gx0; gx <= gx1; gx++) {
                for (let gy = gy0; gy <= gy1; gy++) {
                    const key = gx + gy * 4096;
                    if (!grid.has(key)) grid.set(key, []);
                    grid.get(key).push(i);
                }
            }
        });
    }

    pick(x, y) {
        const list = this.grid.get(Math.floor(x / this.cell) + Math.floor(y / this.cell) * 4096);
        if (!list) return -1;
        const ctx = this.ctx;
        for (let k = list.length - 1; k >= 0; k--) {
            const p = this.pieces[list[k]];
            if (ctx.isPointInPath(p.path, x, y) && (!p.clips || p.clips.every((c) => ctx.isPointInPath(c, x, y)))) return list[k];
        }
        return -1;
    }

    renderGlass() {
        const { w, h, dpr } = this;
        this.glass = this.glass || document.createElement('canvas');
        this.glass.width = w; this.glass.height = h;
        const g = this.glass.getContext('2d');
        g.lineJoin = 'round';
        g.fillStyle = LEAD;
        g.fillRect(0, 0, w, h);

        this.pieces.forEach((p, i) => {
            const col = this.colors[i];
            g.save();
            p.clips?.forEach((c) => g.clip(c));
            if (typeof col === 'string') {
                g.fillStyle = col;
            } else {
                const grad = g.createLinearGradient(...col.from, ...col.to);
                grad.addColorStop(0, col.c0);
                grad.addColorStop(1, col.c1);
                g.fillStyle = grad;
            }
            g.fill(p.path);
            /* Glass darkens where it meets the lead. */
            g.save();
            g.clip(p.path);
            g.lineWidth = 8 * dpr;
            g.strokeStyle = 'rgba(30, 8, 30, 0.22)';
            g.stroke(p.path);
            g.restore();
            g.lineWidth = p.lead * dpr;
            g.strokeStyle = LEAD;
            g.stroke(p.path);
            g.restore();
        });

        const { C, R, far, spokes, outlines, lead } = this.deco;
        for (const o of outlines) {
            g.save();
            g.clip(o.clip);
            g.lineWidth = o.width * dpr;
            g.strokeStyle = LEAD;
            g.stroke(o.path);
            g.restore();
        }
        g.strokeStyle = LEAD;
        g.lineCap = 'butt';
        g.lineWidth = lead * 0.85;
        for (const a of spokes) {
            g.beginPath();
            g.moveTo(...polar(C, a, R));
            g.lineTo(...polar(C, a, far * 1.5));
            g.stroke();
        }
        g.lineWidth = lead;
        g.beginPath();
        g.arc(C[0], C[1], R, 0, Math.PI * 2);
        g.stroke();
        /* A faint shine along the heavy lead. */
        g.strokeStyle = 'rgba(255,255,255,0.1)';
        g.lineWidth = 1.2 * dpr;
        g.beginPath();
        g.arc(C[0], C[1], R - lead * 0.3, Math.PI * 0.9, Math.PI * 1.6);
        g.stroke();

        g.globalCompositeOperation = 'overlay';
        const mottle = g.createPattern(this.mottle, 'repeat');
        mottle.setTransform(new DOMMatrix().scale(dpr * 1.4));
        g.globalAlpha = 0.4;
        g.fillStyle = mottle;
        g.fillRect(0, 0, w, h);
        g.globalAlpha = 0.34;
        g.fillStyle = g.createPattern(this.noise, 'repeat');
        g.fillRect(0, 0, w, h);
        const ripple = g.createPattern(this.ripples, 'repeat');
        ripple.setTransform(new DOMMatrix().rotate(-28).scale(dpr));
        g.globalAlpha = 0.3;
        g.fillStyle = ripple;
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
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
            hue: pick([42, 48, 52, 56]),
        });
    }

    /* The cursor is the sun: glints catch on lead joints near it, more often the closer they are. */
    spawnGlints(tries = 2) {
        const reach = Math.max(this.w, this.h) * 0.2;
        const sx = this.light.x * this.w, sy = this.light.y * this.h;
        for (let k = 0; k < tries; k++) {
            if (Math.random() > 0.5) continue;
            const ang = rand(0, Math.PI * 2), d = reach * Math.abs(rand(-1, 1) * rand(0, 1));
            const i = this.pick(sx + Math.cos(ang) * d, sy + Math.sin(ang) * d);
            if (i < 0) continue;
            const [x, y] = pick(this.pieces[i].poly);
            const near = 1 - Math.min(1, Math.hypot(x - sx, y - sy) / reach);
            if (near > 0) this.addSparkle(x, y, { size: 4 + 10 * near, max: rand(30, 70) });
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
        /* Glass away from the sun sits a little dimmer. */
        ctx.fillStyle = 'rgba(12, 8, 30, 0.2)';
        ctx.fillRect(0, 0, w, h);

        /* Near the sun the glass lights up in its own colors, like light coming through it. */
        const lx = this.light.x * w, ly = this.light.y * h;
        const R = Math.round(Math.max(w, h) * 0.28);
        const buf = this.lightBuf = this.lightBuf || document.createElement('canvas');
        if (buf.width !== R * 2) { buf.width = buf.height = R * 2; }
        const b = buf.getContext('2d');
        b.globalCompositeOperation = 'source-over';
        b.clearRect(0, 0, R * 2, R * 2);
        b.drawImage(this.glass, lx - R, ly - R, R * 2, R * 2, 0, 0, R * 2, R * 2);
        b.globalCompositeOperation = 'destination-in';
        const mask = b.createRadialGradient(R, R, 0, R, R, R);
        mask.addColorStop(0, 'rgba(0,0,0,1)');
        mask.addColorStop(0.35, 'rgba(0,0,0,0.55)');
        mask.addColorStop(1, 'rgba(0,0,0,0)');
        b.fillStyle = mask;
        b.fillRect(0, 0, R * 2, R * 2);
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.45;
        ctx.drawImage(buf, lx - R, ly - R);
        ctx.globalAlpha = 1;

        ctx.globalCompositeOperation = 'screen';
        const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 0.6);
        glow.addColorStop(0, 'rgba(255,248,225,0.5)');
        glow.addColorStop(0.25, 'rgba(255,240,200,0.16)');
        glow.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(lx - R, ly - R, R * 2, R * 2);

        if (this.hover >= 0) {
            const p = this.pieces[this.hover];
            ctx.save();
            p.clips?.forEach((c) => ctx.clip(c));
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fill(p.path);
            ctx.globalCompositeOperation = 'source-over';
            ctx.lineWidth = p.lead * this.dpr;
            ctx.strokeStyle = LEAD;
            ctx.stroke(p.path);
            ctx.restore();
        }
        ctx.globalCompositeOperation = 'source-over';
        this.drawSparkles();
    }

    loop() {
        this.running = true;
        const tick = () => {
            this.t += 0.003;
            /* Without a mouse, the sun drifts slowly across the window on its own. */
            if (!this.light.active && !reduceMotion) {
                this.light.x = 0.5 + Math.sin(this.t * 1.3) * 0.45;
                this.light.y = 0.45 + Math.sin(this.t * 0.9 + 1) * 0.35;
            }
            if (reduceMotion) {
                if (!this.sparkles.length) {
                    for (let i = 0; i < 40; i++) this.spawnGlints();
                    this.sparkles.forEach((s) => { s.life = s.max / 2; s.max = Infinity; });
                }
            } else {
                this.spawnGlints();
            }
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
            if (!this.pieces || e.pointerType === 'touch') return;
            const [x, y] = this.toLocal(e);
            this.light = { x: x / this.w, y: y / this.h, active: true };
            this.hover = e.target === this.canvas ? this.pick(x, y) : -1;
            if (reduceMotion) this.sparkles = [];
            frame?.light(e.clientX, e.clientY);
        });
        document.addEventListener('pointerleave', () => { this.hover = -1; });
        this.canvas.addEventListener('click', (e) => {
            if (!this.pieces) return;
            const [x, y] = this.toLocal(e);
            const i = this.pick(x, y);
            if (i >= 0) this.spread(i, x, y);
        });
    }

    /* Recolor a piece, then let the color ripple outward through the pieces around it. */
    spread(start, x, y) {
        const jewel = pick(JEWELS);
        const band = 50 * this.dpr;
        const p0 = this.pieces[start];
        const rings = [[start], [], []];
        this.pieces.forEach((p, i) => {
            if (i === start) return;
            const d = Math.hypot(p.cx - p0.cx, p.cy - p0.cy);
            if (d < band * 3 && Math.random() < 0.7) rings[Math.min(2, Math.floor(d / band))].push(i);
        });
        rings.forEach((ring, depth) => {
            setTimeout(() => {
                for (const i of ring) this.colors[i] = jewelHsl(jewel, 0.1);
                this.renderGlass();
            }, reduceMotion ? 0 : depth * 90);
        });
        if (!reduceMotion) {
            for (let k = 0; k < 10; k++) {
                const a = rand(0, Math.PI * 2), v = rand(1, 4) * this.dpr;
                this.addSparkle(x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, size: rand(5, 11), max: rand(30, 55) });
            }
        }
    }

    reset() {
        this.colors = this.base.slice();
        this.renderGlass();
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

/* A rose window drawn into an SVG: twelve outer petals, six inner lobes, a gold boss. */
function roseWindow(svg, cx, cy, R) {
    const g = el('g', { class: 'rose-window', stroke: LEAD, 'stroke-linejoin': 'round' }, svg);
    const at = (a, r) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    el('circle', { cx, cy, r: R, fill: '#2b3fe0', 'stroke-width': Math.max(2.5, R * 0.08) }, g);
    for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const [x, y] = at(a, R * 0.74);
        el('circle', { cx: x, cy: y, r: R * 0.2, fill: i % 2 ? '#ffd23f' : '#e0245e', 'stroke-width': 1.6 }, g);
    }
    for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
        const [x, y] = at(a, R * 0.36);
        el('circle', { cx: x, cy: y, r: R * 0.22, fill: ['#1fa84f', '#13b9c9', '#8a3cf0'][i % 3], 'stroke-width': 1.6 }, g);
    }
    el('circle', { cx, cy, r: R * 0.15, fill: '#fff1a1', 'stroke-width': 1.6 }, g);
    const shine = el('circle', { cx: cx - R * 0.25, cy: cy - R * 0.3, r: R * 0.75, fill: 'url(#rose-shine)', stroke: 'none' }, g);
    const defs = el('defs', {}, svg);
    const grad = el('radialGradient', { id: 'rose-shine' }, defs);
    el('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.45 }, grad);
    el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 }, grad);
    return shine;
}

function addRose() {
    const icon = document.querySelector('link[rel="icon"]');
    if (icon) icon.href = 'data:image/svg+xml,' + encodeURIComponent(roseSvg(64));
}

/* The text sits on a clear pane shaped like a pointed arch, rimmed in lead with a fillet of gold glass. */
const SVG_NS = 'http://www.w3.org/2000/svg';

/* A pointed arch from two circular arcs springing at `spring`; `d` insets it as a parallel line. */
function arch(W, H, I, spring, rise, d = 0) {
    const a = W / 2 - I;
    const r = (a * a + rise * rise) / (2 * a);
    const cl = I + r, rr = r - d;
    const mid = W / 2;
    const apex = spring - Math.sqrt(rr * rr - (mid - cl) ** 2);
    const xl = I + d, xr = W - I - d, bottom = H - I - d;
    const f = (n) => n.toFixed(1);
    return {
        path: `M${f(xl)} ${f(bottom)} L${f(xl)} ${f(spring)} A${f(rr)} ${f(rr)} 0 0 1 ${f(mid)} ${f(apex)} A${f(rr)} ${f(rr)} 0 0 1 ${f(xr)} ${f(spring)} L${f(xr)} ${f(bottom)} Z`,
        /* Half the clear width at height y. */
        halfWidth: (y) => (y >= spring ? mid - xl : y <= apex ? 0 : mid - (cl - Math.sqrt(rr * rr - (spring - y) ** 2))),
        apex,
    };
}

function el(tag, attrs, parent) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    parent?.appendChild(node);
    return node;
}

function addPaneFrame() {
    const pane = document.querySelector('.container');
    if (!pane) return null;
    const glass = document.createElement('div');
    glass.className = 'pane-glass';
    const svg = el('svg', { class: 'pane-frame', 'aria-hidden': 'true' });
    pane.prepend(glass, svg);
    let last = '';

    const draw = () => {
        const W = pane.clientWidth, H = pane.clientHeight;
        const small = W < 520;
        const I = small ? 4 : 6;
        const fillet = small ? 6 : 8;
        /* A wide pane gets a flatter point so the text isn't pushed far down. */
        const rise = (W / 2 - I) * (small ? 1.2 : 0.42);
        const spring = I + rise;
        const outerArch = arch(W, H, I, spring, rise);
        const innerArch = arch(W, H, I, spring, rise, fillet);
        /* Start the text where the arch is wide enough for the tabs. */
        const nav = pane.querySelector('.header-links');
        const tabs = nav ? [...nav.children].map((c) => c.getBoundingClientRect()) : [];
        const tabsWidth = tabs.length ? Math.max(...tabs.map((r) => r.right)) - Math.min(...tabs.map((r) => r.left)) : 320;
        const need = tabsWidth / 2 + (small ? 16 : 30);
        let top = innerArch.apex;
        while (top < spring && innerArch.halfWidth(top) < need) top += 2;
        top = Math.max(top, I + rise * 0.3);
        pane.style.paddingTop = `${Math.round(top)}px`;
        /* Then push the paragraphs down to where the arch is as wide as the text. */
        const text = pane.querySelector('.content');
        const textHalf = text ? text.clientWidth / 2 + 6 : W / 2;
        let body = top;
        while (body < spring && innerArch.halfWidth(body) < textHalf) body += 2;
        if (nav) nav.style.marginBottom = `${Math.max(0, Math.round(body - top - nav.offsetHeight - 24))}px`;
        const key = `${W}x${H}`;
        if (key === last) return;
        last = key;

        svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
        svg.setAttribute('width', W);
        svg.setAttribute('height', H);
        svg.replaceChildren();
        glass.style.clipPath = `path('${innerArch.path}')`;
        /* The rim is a ring of gold glass pieces, alternating pale and deep, each joined by lead. */
        const midArch = arch(W, H, I, spring, rise, fillet / 2).path;
        el('path', { d: `${outerArch.path} ${innerArch.path}`, 'fill-rule': 'evenodd', fill: '#f6dc8a' }, svg);
        el('path', { d: midArch, fill: 'none', stroke: '#e3ad3c', 'stroke-width': fillet, 'stroke-dasharray': '22 22' }, svg);
        el('path', { d: midArch, fill: 'none', stroke: LEAD, 'stroke-width': fillet, 'stroke-dasharray': '1.6 20.4', 'stroke-dashoffset': 0.8 }, svg);

        /* A rose window in the head of the arch, above the tabs. */
        const roseR = Math.min(small ? 26 : 40, (top - innerArch.apex) * 0.3);
        const roseY = innerArch.apex + (top - innerArch.apex) * 0.48;
        if (roseR > 14 && innerArch.halfWidth(roseY) > roseR + 10) roseWindow(svg, W / 2, roseY, roseR);
        el('path', { d: outerArch.path, fill: 'none', stroke: LEAD, 'stroke-width': small ? 5 : 6, 'stroke-linejoin': 'round' }, svg);
        el('path', { d: innerArch.path, fill: 'none', stroke: LEAD, 'stroke-width': small ? 2 : 2.5, 'stroke-linejoin': 'round' }, svg);
    };

    new ResizeObserver(draw).observe(pane);
    draw();

    return {
        /* Sunlight from the cursor falls across the clear pane too. */
        light(clientX, clientY) {
            const r = pane.getBoundingClientRect();
            glass.style.setProperty('--lx', `${clientX - r.left}px`);
            glass.style.setProperty('--ly', `${clientY - r.top}px`);
        },
    };
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
const frame = addPaneFrame();
addCames();

const bg = document.querySelector('.glass-bg');
if (bg) {
    const win = new GlassWindow(bg);
    document.querySelector('[data-action="relead"]')?.addEventListener('click', () => win.build());
    document.querySelector('[data-action="reset"]')?.addEventListener('click', () => win.reset());
}
