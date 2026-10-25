import { Delaunay } from 'https://cdn.jsdelivr.net/npm/d3-delaunay@6/+esm';

const JEWELS = ['#e0245e', '#2b3fe0', '#1fa84f', '#ff8a1f', '#8a3cf0', '#13b9c9', '#ffd23f', '#ff5fa2', '#159bdc'];
const LEAD = '#141018';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const hasMouse = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* Color ramps from a sunlit tree window, each running from the light outward into shadow. */
const SKY = ['#fff6c8', '#d8f0ff', '#b0e0ff', '#8fd0ff', '#5ab8f0', '#3f9ae8', '#3f7cf0', '#4a5fe0', '#5546d0', '#5a32b8', '#4a2196'];
const LEAF = ['#fff1a1', '#f2e45a', '#d6ec5a', '#b0e04a', '#7fd03b', '#4cb848', '#24a148', '#1d8a5a', '#16706a', '#1f5a7a'];
const BARK = ['#f6c050', '#e09a30', '#b8682a', '#8a4a3a', '#5a2f5e', '#4a2470', '#3a1f6a', '#2a1650', '#1e1240'];
const GROUND = ['#ff5fa2', '#e0307a', '#d4143c', '#c2185b', '#9b2a9a', '#8a3cf0', '#6a2fd0', '#4a2fb0', '#2b3fe0'];
const PALETTE = [...SKY.slice(2, 9), ...LEAF.slice(1, 7), ...GROUND.slice(0, 6)].map((c) => [c, 1]);

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

/* The window behind the whole page: trees in leaded glass, branches spreading against the sky. */
class GlassWindow {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.noise = makeNoise();
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

    /* Grow branching trees; each branch is a tapered segment, each twig tip carries a cluster of leaves. */
    growTrees(w, h, small, dpr) {
        const ground = h * (small ? 0.9 : 0.86);
        const roots = small ? [[0.5, 1]] : [[0.17, 1], [0.84, 0.92]];
        const branches = [], leaves = [];
        const grow = (x, y, ang, len, thick, depth) => {
            const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
            branches.push({ x1: x, y1: y, x2, y2, t1: thick, t2: thick * 0.72 });
            if (depth === 0 || thick < 7 * dpr) {
                leaves.push({ x: x2, y: y2, r: len * rand(1.3, 1.9) + 50 * dpr });
                return;
            }
            const kids = depth > 3 ? 2 : pick([2, 2, 3]);
            for (let k = 0; k < kids; k++) {
                const spread = kids === 2 ? (k ? 1 : -1) * rand(0.32, 0.62) : (k - 1) * rand(0.45, 0.7);
                /* Branches bend toward the horizontal so the crown spreads wide. */
                const a = ang + spread + (ang < -Math.PI / 2 ? -0.08 : 0.08);
                grow(x2, y2, a, len * rand(0.68, 0.8), thick * 0.68, depth - 1);
            }
            if (depth <= 2) leaves.push({ x: x2, y: y2, r: len * 1.1 });
        };
        const scale = Math.min(w, h * 1.4);
        for (const [fx, size] of roots) {
            const x = (fx + rand(-0.02, 0.02)) * w;
            const lean = (0.5 - fx) * 0.25 + rand(-0.05, 0.05);
            const thick = scale * 0.09 * size;
            grow(x, ground + 20 * dpr, -Math.PI / 2 + lean, h * 0.32 * size, thick, small ? 5 : 6);
            /* Roots flare out across the floor. */
            for (const side of [-1, 1]) {
                for (let k = 0; k < 2; k++) {
                    const a = Math.PI / 2 + side * rand(1.05, 1.35) - side * k * 0.35;
                    const len = h * rand(0.08, 0.13) * (k ? 0.7 : 1);
                    const y = ground - thick * 0.15;
                    branches.push({ x1: x, y1: y, x2: x + Math.cos(a) * len, y2: y + Math.sin(a) * len, t1: thick * (k ? 0.35 : 0.5), t2: thick * 0.1 });
                }
            }
        }
        leaves.forEach((l) => { l.p = rand(0, 6.3); l.k = pick([4, 5, 6, 7]); });
        return { ground, branches, leaves };
    }

    build() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.round(this.canvas.clientWidth * dpr), h = Math.round(this.canvas.clientHeight * dpr);
        if (!w || !h) return;
        this.canvas.width = w; this.canvas.height = h;
        this.w = w; this.h = h; this.dpr = dpr;

        const small = window.innerWidth < 600;
        const { ground, branches, leaves } = this.trees = this.growTrees(w, h, small, dpr);
        const glowAt = [w * rand(0.35, 0.65), h * rand(0.25, 0.45)];

        /* How far a point sits outside the nearest branch (negative inside the wood). */
        const barkGap = (x, y) => {
            let best = Infinity;
            for (const b of branches) {
                const dx = b.x2 - b.x1, dy = b.y2 - b.y1;
                const t = Math.max(0, Math.min(1, ((x - b.x1) * dx + (y - b.y1) * dy) / (dx * dx + dy * dy)));
                const half = (b.t1 + (b.t2 - b.t1) * t) / 2;
                best = Math.min(best, Math.hypot(x - (b.x1 + dx * t), y - (b.y1 + dy * t)) - half);
            }
            return best;
        };
        const leafAt = (x, y) => leaves.some((l) => {
            const d = Math.hypot(x - l.x, y - l.y);
            return d < l.r * (0.84 + 0.16 * Math.sin(Math.atan2(y - l.y, x - l.x) * l.k + l.p));
        });
        const outside = (x, y) => (y > ground ? 'ground' : leafAt(x, y) ? 'leaf' : 'sky');

        const points = [], meta = [];
        const add = (x, y, kind) => { points.push([x, y]); meta.push(kind); };
        const onScreen = (x, y) => x > -40 * dpr && y > -40 * dpr && x < w + 40 * dpr && y < h + 40 * dpr;

        /* Seeds in pairs just inside and just outside each branch, so a lead line runs along the edge of the wood. */
        const s = (small ? 14 : 18) * dpr;
        for (const b of branches) {
            const len = Math.hypot(b.x2 - b.x1, b.y2 - b.y1);
            const nx = -(b.y2 - b.y1) / len, ny = (b.x2 - b.x1) / len;
            for (let d = 0; d < len; d += s * rand(1.1, 1.6)) {
                const t = d / len;
                const half = (b.t1 + (b.t2 - b.t1) * t) / 2;
                const cx = b.x1 + (b.x2 - b.x1) * t, cy = b.y1 + (b.y2 - b.y1) * t;
                for (const side of [-1, 1]) {
                    const ix = cx + nx * side * Math.max(0, half - s * 0.45), iy = cy + ny * side * Math.max(0, half - s * 0.45);
                    if ((half > s * 0.5 || side > 0) && barkGap(ix, iy) < 0) add(ix, iy, 'bark');
                    const ox = cx + nx * side * (half + s * 0.45), oy = cy + ny * side * (half + s * 0.45);
                    if (barkGap(ox, oy) > s * 0.3) add(ox, oy, outside(ox, oy));
                }
                /* Wide trunks get a few pieces across their middle too. */
                const across = Math.floor((half * 2) / (s * 1.6));
                for (let k = 1; half * 2 > s * 2.6 && k < across; k++) {
                    const off = -half + (k * half * 2) / across + rand(-0.2, 0.2) * s;
                    add(cx + nx * off, cy + ny * off, 'bark');
                }
            }
        }

        /* Sky: long shards fanning out from the glow like rays of light. */
        const [gx, gy] = glowAt;
        const far = Math.hypot(w, h);
        const tsp = (small ? 22 : 28) * dpr;
        for (let r = tsp * 0.6; r < far; ) {
            const span = tsp * (1 + (r / far) * 0.9);
            const n = Math.max(6, Math.round((Math.PI * 2 * r) / span));
            const off = rand(0, 1);
            for (let j = 0; j < n; j++) {
                const a = ((j + off + rand(-0.18, 0.18)) / n) * Math.PI * 2;
                const rr = r + rand(-0.25, 0.25) * span;
                const x = gx + Math.cos(a) * rr, y = gy + Math.sin(a) * rr;
                if (!onScreen(x, y) || y > ground || barkGap(x, y) < s * 1.1 || leafAt(x, y)) continue;
                add(x, y, 'sky');
            }
            r += span * rand(2, 2.6);
        }
        /* Leaves: small, irregular pieces. */
        const leafCell = (small ? 18 : 22) * dpr;
        for (let y = leafCell / 2; y < ground; y += leafCell * 0.86) {
            for (let x = leafCell / 2; x < w + leafCell; x += leafCell) {
                const px = x + rand(-0.45, 0.45) * leafCell, py = y + rand(-0.45, 0.45) * leafCell;
                if (py < ground && leafAt(px, py) && barkGap(px, py) > s * 1.1) add(px, py, 'leaf');
            }
        }
        /* Floor: wide bands, getting larger toward the bottom. */
        for (let y = ground, row = 26 * dpr; y < h + row; y += row, row *= 1.18) {
            const off = rand(0, 1);
            for (let x = -row * 2; x < w + row * 2; x += row * rand(2, 2.8)) {
                const px = x + off * row, py = y + row * (0.5 + rand(-0.2, 0.2));
                if (barkGap(px, py) > s * 1.1) add(px, py, 'ground');
            }
        }

        this.points = points;
        this.meta = meta;
        this.delaunay = Delaunay.from(points);
        this.voronoi = this.delaunay.voronoi([0, 0, w, h]);
        /* Colors follow smooth fields rather than chance: light near the glow, deepening outward, with slow drifts of hue. */
        const ph = Array.from({ length: 4 }, () => rand(0, Math.PI * 2));
        const k = 1 / (240 * dpr);
        const noise = (x, y) => (Math.sin(x * k + ph[0]) + Math.sin(y * k * 1.3 + ph[1])
            + Math.sin((x * 0.7 - y) * k * 0.8 + ph[2]) + 0.5 * Math.sin((x + y) * k * 2.1 + ph[3])) / 3.5;
        const fromRamp = (ramp, t, spread = 1) => {
            const i = Math.round(Math.min(1, Math.max(0, t)) * (ramp.length - 1) + rand(-spread, spread));
            return ramp[Math.min(ramp.length - 1, Math.max(0, i))];
        };
        const reach = Math.max(w, h) * 0.85;
        this.base = meta.map((kind, i) => {
            const [x, y] = points[i];
            const d = Math.hypot(x - gx, y - gy) / reach, n = noise(x, y);
            if (kind === 'bark') return jewelHsl(fromRamp(BARK, 0.15 + d * 1.5 + n * 0.15, 0.8), 0.04);
            if (kind === 'ground') return jewelHsl(fromRamp(GROUND, 0.5 + n * 0.6, 1.2), 0.05);
            if (kind === 'leaf') return jewelHsl(fromRamp(LEAF, d * 1.25 + n * 0.25, 1), 0.04);
            return jewelHsl(fromRamp(SKY, d * 0.82 + n * 0.18, 0.9), 0.04);
        });
        this.glowAt = glowAt;
        this.colors = this.base.slice();
        this.flash = new Float32Array(points.length);
        this.sparkles = [];
        this.renderGlass();
        this.renderLead();
        if (!this.running) this.loop();
    }

    renderGlass() {
        const { w, h, dpr } = this;
        const [gx, gy] = this.glowAt;
        this.glass = this.glass || document.createElement('canvas');
        this.glass.width = w; this.glass.height = h;

        const g = this.glass.getContext('2d');
        for (let i = 0; i < this.colors.length; i++) {
            g.beginPath();
            this.voronoi.renderCell(i, g);
            g.fillStyle = this.colors[i];
            g.fill();
            /* Each pane is brighter on the side facing the glow. */
            const [x0, y0, x1, y1] = this.cellBounds(i);
            const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rad = Math.hypot(x1 - x0, y1 - y0) / 2 || 1;
            const len = Math.hypot(gx - cx, gy - cy) || 1;
            const ux = (gx - cx) / len, uy = (gy - cy) / len;
            const grad = g.createLinearGradient(cx + ux * rad, cy + uy * rad, cx - ux * rad, cy - uy * rad);
            grad.addColorStop(0, 'rgba(255,255,255,0.3)');
            grad.addColorStop(0.45, 'rgba(255,255,255,0)');
            grad.addColorStop(1, this.meta[i] === 'bark' ? 'rgba(0,0,0,0.32)' : 'rgba(0,0,0,0.18)');
            g.fillStyle = grad;
            g.fill();
            if (this.flash[i] > 0) {
                g.fillStyle = `rgba(255,255,240,${this.flash[i] * 0.65})`;
                g.fill();
            }
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
    }

    renderLead() {
        const { w, h, dpr } = this;
        this.leadLayer = this.leadLayer || document.createElement('canvas');
        this.leadLayer.width = w; this.leadLayer.height = h;
        const lead = new Path2D(), wood = new Path2D();
        this.voronoi.render(lead);
        this.meta.forEach((kind, i) => { if (kind === 'bark') this.voronoi.renderCell(i, wood); });

        const l = this.leadLayer.getContext('2d');
        l.lineJoin = 'round';
        /* Glass darkens where it meets the lead. */
        l.save();
        l.filter = `blur(${2.5 * dpr}px)`;
        l.strokeStyle = 'rgba(8, 4, 24, 0.4)';
        l.lineWidth = 7 * dpr;
        l.stroke(lead);
        l.restore();
        l.strokeStyle = LEAD;
        l.lineWidth = 2.4 * dpr;
        l.stroke(lead);
        l.lineWidth = 3.6 * dpr;
        l.stroke(wood);
        /* A faint highlight along the top of each came. */
        l.save();
        l.translate(-0.6 * dpr, -0.6 * dpr);
        l.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        l.lineWidth = 0.8 * dpr;
        l.stroke(lead);
        l.restore();
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
        return x >= 0 && y >= 0 && x <= this.w && y <= this.h;
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
            const cell = this.delaunay.find(sx + Math.cos(ang) * d, sy + Math.sin(ang) * d);
            const poly = this.voronoi.cellPolygon(cell);
            if (!poly) continue;
            const [x, y] = pick(poly);
            const near = 1 - Math.min(1, Math.hypot(x - sx, y - sy) / reach);
            if (near > 0 && this.insideRim(x, y)) this.addSparkle(x, y, { size: 4 + 10 * near, max: rand(30, 70) });
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
        /* Glass away from the sun sits deep and dim. */
        ctx.fillStyle = 'rgba(12, 8, 30, 0.3)';
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
        ctx.globalAlpha = 0.6;
        ctx.drawImage(buf, lx - R, ly - R);
        ctx.globalAlpha = 1;

        ctx.globalCompositeOperation = 'screen';
        const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, R * 0.6);
        glow.addColorStop(0, 'rgba(255,248,225,0.55)');
        glow.addColorStop(0.25, 'rgba(255,240,200,0.18)');
        glow.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(lx - R, ly - R, R * 2, R * 2);

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
            let dirty = false;
            for (let i = 0; i < this.flash.length; i++) {
                if (this.flash[i] > 0) { this.flash[i] = Math.max(0, this.flash[i] - 0.04); dirty = true; }
            }
            if (dirty) this.renderGlass();
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
            if (reduceMotion) this.sparkles = [];
            frame?.light(e.clientX, e.clientY);
        });
        document.addEventListener('pointerleave', () => { this.hover = -1; });
        this.canvas.addEventListener('click', (e) => {
            if (!this.delaunay) return;
            const [x, y] = this.toLocal(e);
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
                this.renderGlass();
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
        const rise = (W / 2 - I) * (small ? 1.2 : 1.15);
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
