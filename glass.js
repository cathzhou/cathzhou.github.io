import { Delaunay } from 'https://cdn.jsdelivr.net/npm/d3-delaunay@6/+esm';

const JEWELS = ['#9b1d3a', '#1f3fa6', '#0f7a52', '#d9930d', '#5b2a86', '#127a86', '#e2b83b', '#c2456b'];
const LEAD = '#2a2420';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Blue dominates, like most cathedral windows, with warm accents. */
const PALETTE = [
    ['#1f3fa6', 26], ['#2a4fc0', 14], ['#152c7a', 10], ['#9b1d3a', 13], ['#d9930d', 8],
    ['#e2b83b', 5], ['#0f7a52', 10], ['#5b2a86', 7], ['#127a86', 7],
];

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
    const ll = Math.min(0.8, Math.max(0.18, l + rand(-jitter, jitter)));
    return `hsl(${(h + rand(-6, 6)).toFixed(1)} ${(Math.min(1, s * rand(0.9, 1.1)) * 100).toFixed(1)}% ${(ll * 100).toFixed(1)}%)`;
}

/* A tiled noise texture that gives panes a hand-blown, uneven look. */
function makeNoise(size = 128) {
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const x = c.getContext('2d');
    const data = x.createImageData(size, size);
    for (let i = 0; i < data.data.length; i += 4) {
        const v = 128 + rand(-40, 40);
        data.data[i] = data.data[i + 1] = data.data[i + 2] = v;
        data.data[i + 3] = 255;
    }
    x.putImageData(data, 0, 0);
    return c;
}

/* The window behind the whole page: leaded panes that catch the light under your cursor. */
class GlassWindow {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.noise = makeNoise();
        this.light = { x: 0.3, y: 0.3, active: false };
        this.hover = -1;
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

        const cell = (window.innerWidth < 600 ? 46 : 64) * dpr;
        const count = Math.round((w * h) / (cell * cell));
        const points = [];
        for (let i = 0; i < count; i++) points.push([Math.random() * w, Math.random() * h]);
        this.delaunay = Delaunay.from(points);
        this.voronoi = this.delaunay.voronoi([0, 0, w, h]);
        this.base = points.map(() => jewelHsl(weighted()));
        this.colors = this.base.slice();
        this.flash = new Float32Array(points.length);
        this.renderLayers();
        if (!this.running) this.loop();
    }

    renderLayers() {
        const { w, h, dpr } = this;
        this.glass = this.glass || document.createElement('canvas');
        this.leadLayer = this.leadLayer || document.createElement('canvas');
        for (const c of [this.glass, this.leadLayer]) { c.width = w; c.height = h; }

        const g = this.glass.getContext('2d');
        for (let i = 0; i < this.colors.length; i++) {
            g.beginPath();
            this.voronoi.renderCell(i, g);
            g.fillStyle = this.colors[i];
            g.fill();
            const [x0, y0, x1, y1] = this.cellBounds(i);
            const grad = g.createLinearGradient(x0, y0, x1, y1);
            grad.addColorStop(0, 'rgba(255,255,255,0.2)');
            grad.addColorStop(0.55, 'rgba(255,255,255,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.2)');
            g.fillStyle = grad;
            g.fill();
            if (this.flash[i] > 0) {
                g.fillStyle = `rgba(255,255,240,${this.flash[i] * 0.6})`;
                g.fill();
            }
        }
        g.globalCompositeOperation = 'overlay';
        g.globalAlpha = 0.2;
        g.fillStyle = g.createPattern(this.noise, 'repeat');
        g.fillRect(0, 0, w, h);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;

        const l = this.leadLayer.getContext('2d');
        l.beginPath();
        this.voronoi.render(l);
        l.strokeStyle = LEAD;
        l.lineWidth = 3 * dpr;
        l.lineJoin = 'round';
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

    draw() {
        const { ctx, w, h } = this;
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(this.glass, 0, 0);
        ctx.fillStyle = 'rgba(10, 8, 20, 0.22)';
        ctx.fillRect(0, 0, w, h);

        const lx = this.light.x * w, ly = this.light.y * h;
        ctx.globalCompositeOperation = 'screen';
        const radius = Math.max(w, h) * (this.light.active ? 0.28 : 0.4);
        const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius);
        glow.addColorStop(0, 'rgba(255,246,220,0.6)');
        glow.addColorStop(0.35, 'rgba(255,238,200,0.2)');
        glow.addColorStop(1, 'rgba(255,238,200,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        if (this.hover >= 0) {
            ctx.beginPath();
            this.voronoi.renderCell(this.hover, ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.32)';
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(this.leadLayer, 0, 0);
    }

    loop() {
        this.running = true;
        const tick = () => {
            this.t += 0.003;
            if (!this.light.active && !reduceMotion) {
                this.light.x = 0.5 + Math.sin(this.t * 1.3) * 0.45;
                this.light.y = 0.45 + Math.sin(this.t * 0.9 + 1) * 0.35;
            }
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
            this.hover = e.target === this.canvas ? this.delaunay.find(x, y) : -1;
        });
        document.addEventListener('pointerleave', () => {
            this.light.active = false;
            this.hover = -1;
        });
        this.canvas.addEventListener('click', (e) => {
            if (!this.delaunay) return;
            const [x, y] = this.toLocal(e);
            this.spread(this.delaunay.find(x, y));
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
