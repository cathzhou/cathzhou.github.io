import { Delaunay } from 'https://cdn.jsdelivr.net/npm/d3-delaunay@6/+esm';

const JEWELS = ['#9b1d3a', '#1f3fa6', '#0f7a52', '#d9930d', '#5b2a86', '#127a86', '#e2b83b', '#c2456b'];
const LEAD = '#2a2420';
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h * 60, s, l];
}

const hsl = (h, s, l) => `hsl(${h.toFixed(1)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%)`;

function jewelHsl(hex, jitter = 0.06) {
    const [h, s, l] = rgbToHsl(...hexToRgb(hex));
    return hsl(h + rand(-6, 6), Math.min(1, s * rand(0.9, 1.1)), Math.min(0.85, Math.max(0.2, l + rand(-jitter, jitter))));
}

/* Pointed (gothic) arch outline. */
function archPath(ctx, w, h, inset = 0) {
    const r = w * 0.6;
    const archH = Math.sqrt(r * r - (r - w / 2) ** 2);
    const y0 = archH + inset;
    ctx.beginPath();
    ctx.moveTo(inset, h - inset);
    ctx.lineTo(inset, y0);
    ctx.arc(r, y0, r - inset, Math.PI, Math.PI + Math.acos((r - w / 2) / r), false);
    ctx.arc(w - r, y0, r - inset, -Math.acos((r - w / 2) / r), 0, false);
    ctx.lineTo(w - inset, h - inset);
    ctx.closePath();
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
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

class GlassPanel {
    constructor(canvas, opts) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.opts = opts;
        this.noise = makeNoise();
        this.light = { x: 0.5, y: 0.35, active: false };
        this.hover = -1;
        this.peek = false;
        this.t = Math.random() * 100;
        this.bindEvents();
        new ResizeObserver(() => this.build()).observe(canvas);
    }

    size() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = this.canvas.clientWidth;
        const h = this.opts.arch ? w * this.opts.ratio : this.canvas.clientHeight;
        if (this.opts.arch) this.canvas.style.height = `${h}px`;
        this.canvas.width = Math.round(w * dpr);
        this.canvas.height = Math.round(h * dpr);
        return { w: this.canvas.width, h: this.canvas.height, dpr };
    }

    async build() {
        const { w, h, dpr } = this.size();
        if (!w || !h) return;
        this.w = w; this.h = h; this.dpr = dpr;

        let sample = null;
        if (this.opts.image) {
            this.img = this.img || await loadImage(this.opts.image);
            sample = this.sampler(w, h);
        }

        const points = this.scatter(w, h, sample);
        this.delaunay = Delaunay.from(points);
        this.voronoi = this.delaunay.voronoi([0, 0, w, h]);
        this.base = points.map(([x, y]) => this.colorFor(x, y, sample));
        this.colors = this.base.slice();
        this.flash = new Float32Array(points.length);
        this.renderLayers();
        if (!this.running) this.loop();
    }

    /* Draw the photo into the bottom square of the window and expose pixel lookups. */
    sampler(w, h) {
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const x = c.getContext('2d');
        x.fillStyle = '#e1d9d1';
        x.fillRect(0, 0, w, h);
        const s = w * 0.96;
        x.drawImage(this.img, (w - s) / 2, h - s * 0.97, s, s);
        this.photo = c;
        const data = x.getImageData(0, 0, w, h).data;
        const bg = [225, 217, 209];
        const at = (px, py) => {
            const i = (Math.min(h - 1, Math.max(0, py | 0)) * w + Math.min(w - 1, Math.max(0, px | 0))) * 4;
            return [data[i], data[i + 1], data[i + 2]];
        };
        const isSubject = (px, py) => {
            const [r, g, b] = at(px, py);
            return Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) > 28;
        };
        const edge = (px, py) => {
            const d = 3 * this.dpr;
            const lum = (p) => p[0] * 0.3 + p[1] * 0.59 + p[2] * 0.11;
            const gx = lum(at(px + d, py)) - lum(at(px - d, py));
            const gy = lum(at(px, py + d)) - lum(at(px, py - d));
            return Math.min(1, Math.hypot(gx, gy) / 60);
        };
        return { at, isSubject, edge };
    }

    scatter(w, h, sample) {
        const area = (w * h) / (this.dpr * this.dpr);
        const target = Math.round(area / (sample ? 420 : 900));
        const pts = [];
        let guard = 0;
        while (pts.length < target && guard++ < target * 40) {
            const x = Math.random() * w, y = Math.random() * h;
            let p = sample ? 0.1 : 1;
            if (sample) {
                if (sample.isSubject(x, y)) p += 0.18;
                p += sample.edge(x, y) * 1.1;
            }
            if (Math.random() < p) pts.push([x, y]);
        }
        return pts;
    }

    colorFor(x, y, sample) {
        if (!sample) return jewelHsl(pick(JEWELS), 0.08);
        if (!sample.isSubject(x, y)) {
            if (Math.random() < 0.14) return jewelHsl(pick(['#9b1d3a', '#0f7a52', '#e2b83b', '#5b2a86']), 0.06);
            return hsl(rand(212, 232), rand(0.55, 0.75), rand(0.3, 0.5));
        }
        const d = 2 * this.dpr;
        let r = 0, g = 0, b = 0;
        for (const [ox, oy] of [[0, 0], [d, 0], [-d, 0], [0, d], [0, -d]]) {
            const c = sample.at(x + ox, y + oy);
            r += c[0]; g += c[1]; b += c[2];
        }
        const [hh, ss, ll] = rgbToHsl(r / 5, g / 5, b / 5);
        return hsl(hh, Math.min(0.9, ss * 1.35 + 0.08), Math.min(0.92, Math.max(0.12, ll + rand(-0.03, 0.03))));
    }

    clip(ctx) {
        if (this.opts.arch) {
            archPath(ctx, this.w, this.h, 3 * this.dpr);
            ctx.clip();
        }
    }

    renderLayers() {
        const { w, h, dpr } = this;
        this.glass = this.glass || document.createElement('canvas');
        this.leadLayer = this.leadLayer || document.createElement('canvas');
        for (const c of [this.glass, this.leadLayer]) { c.width = w; c.height = h; }

        const g = this.glass.getContext('2d');
        g.save();
        this.clip(g);
        const n = this.colors.length;
        for (let i = 0; i < n; i++) {
            g.beginPath();
            this.voronoi.renderCell(i, g);
            g.fillStyle = this.colors[i];
            g.fill();
            const [x0, y0, x1, y1] = this.cellBounds(i);
            const grad = g.createLinearGradient(x0, y0, x1, y1);
            grad.addColorStop(0, 'rgba(255,255,255,0.22)');
            grad.addColorStop(0.55, 'rgba(255,255,255,0)');
            grad.addColorStop(1, 'rgba(0,0,0,0.16)');
            g.fillStyle = grad;
            g.fill();
            if (this.flash[i] > 0) {
                g.fillStyle = `rgba(255,255,240,${this.flash[i] * 0.6})`;
                g.fill();
            }
        }
        g.globalCompositeOperation = 'overlay';
        g.globalAlpha = 0.18;
        g.fillStyle = g.createPattern(this.noise, 'repeat');
        g.fillRect(0, 0, w, h);
        g.restore();

        const l = this.leadLayer.getContext('2d');
        l.save();
        this.clip(l);
        l.beginPath();
        this.voronoi.render(l);
        l.strokeStyle = LEAD;
        l.lineWidth = 2.4 * dpr;
        l.lineJoin = 'round';
        l.stroke();
        l.restore();
        l.lineWidth = 6 * dpr;
        l.strokeStyle = LEAD;
        if (this.opts.arch) {
            archPath(l, w, h, 3 * dpr);
            l.stroke();
        } else {
            l.strokeRect(0, 0, w, h);
        }
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
        const { ctx, w, h, dpr } = this;
        ctx.clearRect(0, 0, w, h);
        if (this.peek && this.photo) {
            ctx.save();
            this.clip(ctx);
            ctx.drawImage(this.photo, 0, 0);
            ctx.restore();
            ctx.drawImage(this.leadLayer, 0, 0);
            return;
        }
        ctx.drawImage(this.glass, 0, 0);

        const lx = this.light.x * w, ly = this.light.y * h;
        ctx.save();
        this.clip(ctx);
        ctx.globalCompositeOperation = 'screen';
        const radius = (this.opts.arch ? 0.45 * w : 1.2 * h) * (this.light.active ? 0.8 : 1);
        const glow = ctx.createRadialGradient(lx, ly, 0, lx, ly, radius);
        glow.addColorStop(0, 'rgba(255,248,225,0.55)');
        glow.addColorStop(0.4, 'rgba(255,240,200,0.18)');
        glow.addColorStop(1, 'rgba(255,240,200,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, w, h);
        if (this.hover >= 0) {
            ctx.beginPath();
            this.voronoi.renderCell(this.hover, ctx);
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.fill();
        }
        ctx.restore();
        ctx.drawImage(this.leadLayer, 0, 0);
    }

    loop() {
        this.running = true;
        const tick = () => {
            this.t += 0.004;
            if (!this.light.active && !reduceMotion) {
                this.light.x = 0.5 + Math.sin(this.t * 1.3) * 0.38;
                this.light.y = (this.opts.arch ? 0.45 : 0.5) + Math.sin(this.t * 0.9 + 1) * 0.3;
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
        const c = this.canvas;
        c.addEventListener('pointermove', (e) => {
            if (!this.delaunay) return;
            const [x, y] = this.toLocal(e);
            this.light = { x: x / this.w, y: y / this.h, active: true };
            this.hover = this.delaunay.find(x, y);
        });
        c.addEventListener('pointerleave', () => {
            this.light.active = false;
            this.hover = -1;
        });
        c.addEventListener('click', (e) => {
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

/* Soft patches of colored light drifting over the page, like sun through a window. */
function addLightField() {
    const field = document.createElement('div');
    field.className = 'light-field';
    field.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 6; i++) {
        const spot = document.createElement('span');
        spot.style.setProperty('--c', JEWELS[(i * 3) % JEWELS.length]);
        spot.style.setProperty('--x', `${rand(-10, 90)}vw`);
        spot.style.setProperty('--y', `${rand(-10, 90)}vh`);
        spot.style.setProperty('--s', `${rand(28, 48)}vmax`);
        spot.style.setProperty('--d', `${rand(28, 46)}s`);
        spot.style.animationDelay = `${-rand(0, 40)}s`;
        field.appendChild(spot);
    }
    document.body.prepend(field);
}

addRose();
addLightField();

const windowCanvas = document.querySelector('.glass-window canvas');
if (windowCanvas) {
    const panel = new GlassPanel(windowCanvas, { arch: true, ratio: 1.08, image: windowCanvas.dataset.image });
    const fig = windowCanvas.closest('.glass-window');
    fig.querySelector('[data-action="relead"]')?.addEventListener('click', () => panel.build());
    fig.querySelector('[data-action="reset"]')?.addEventListener('click', () => panel.reset());
    const peek = fig.querySelector('[data-action="peek"]');
    if (peek) {
        const on = (e) => { e.preventDefault(); panel.peek = true; };
        const off = () => { panel.peek = false; };
        peek.addEventListener('pointerdown', on);
        for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) peek.addEventListener(ev, off);
    }
}

document.querySelectorAll('.glass-transom canvas').forEach((c) => new GlassPanel(c, { arch: false }));
