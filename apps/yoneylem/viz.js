/* Visual output for the solver: LP feasible region (2 variables) or variable bars (more),
   and queueing charts. Pure SVG, no dependencies; reads colours from the page's CSS variables. */
(function () {
    const W = 460, H = 330, M = { l: 58, r: 16, t: 14, b: 38 };
    const f = (v) => Number(v).toFixed(2).replace(/\.?0+$/, "") || "0";
    const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
    const EPS = 1e-7;

    function ok(c, x, y, a1, a2) {
        const v = a1 * x + a2 * y;
        if (c.op === "<=") return v <= c.rhs + EPS * (1 + Math.abs(c.rhs));
        if (c.op === ">=") return v >= c.rhs - EPS * (1 + Math.abs(c.rhs));
        return Math.abs(v - c.rhs) <= EPS * (1 + Math.abs(c.rhs));
    }

    function vertices(lines, cons) {
        const out = [];
        for (let i = 0; i < lines.length; i++) for (let j = i + 1; j < lines.length; j++) {
            const [a, b, c] = lines[i], [d, e, g] = lines[j];
            const det = a * e - b * d;
            if (Math.abs(det) < 1e-12) continue;
            const x = (c * e - b * g) / det, y = (a * g - c * d) / det;
            if (cons.every((k) => ok(k.c, x, y, k.a, k.b))) out.push([x, y]);
        }
        return out;
    }

    function lpFigure(problem, sol) {
        const vars = problem.variables;
        if (vars.length !== 2) return barFigure(vars, sol);
        const [vx, vy] = vars;
        const cons = problem.constraints.map((c) => ({ c, a: c.coeffs[vx] || 0, b: c.coeffs[vy] || 0 }));
        if (problem.nonnegative) {
            cons.push({ c: { op: ">=", rhs: 0 }, a: 1, b: 0 }, { c: { op: ">=", rhs: 0 }, a: 0, b: 1 });
        }
        const lineOf = (k) => [k.a, k.b, k.c.rhs];
        const opt = [sol.variable_values[vx] || 0, sol.variable_values[vy] || 0];
        const v1 = vertices(cons.map(lineOf), cons);
        const big = Math.max(1, ...v1.flat().map(Math.abs), ...opt.map(Math.abs));
        const box = big * 1.45;
        const capped = cons.concat([{ c: { op: "<=", rhs: box }, a: 1, b: 0 }, { c: { op: "<=", rhs: box }, a: 0, b: 1 }]);
        if (!problem.nonnegative) capped.push({ c: { op: ">=", rhs: -box }, a: 1, b: 0 }, { c: { op: ">=", rhs: -box }, a: 0, b: 1 });
        let poly = vertices(capped.map(lineOf), capped);
        if (!poly.length) return "";
        const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length, cy = poly.reduce((s, p) => s + p[1], 0) / poly.length;
        poly.sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
        const xmin = problem.nonnegative ? 0 : Math.min(...poly.map((p) => p[0]), 0);
        const ymin = problem.nonnegative ? 0 : Math.min(...poly.map((p) => p[1]), 0);
        const xmax = Math.max(...poly.map((p) => p[0]), opt[0]) * 1.08 || 1;
        const ymax = Math.max(...poly.map((p) => p[1]), opt[1]) * 1.08 || 1;
        const sx = (x) => M.l + ((x - xmin) / (xmax - xmin)) * (W - M.l - M.r);
        const sy = (y) => H - M.b - ((y - ymin) / (ymax - ymin)) * (H - M.t - M.b);
        const inView = (x, y) => x >= xmin - 1e-9 && x <= xmax && y >= ymin - 1e-9 && y <= ymax;
        // clip a line a*x+b*y=c to the view rectangle
        const clip = (a, b, c) => {
            const pts = [];
            if (Math.abs(b) > 1e-12) for (const x of [xmin, xmax]) { const y = (c - a * x) / b; if (y >= ymin - 1e-9 && y <= ymax + 1e-9) pts.push([x, y]); }
            if (Math.abs(a) > 1e-12) for (const y of [ymin, ymax]) { const x = (c - b * y) / a; if (x >= xmin - 1e-9 && x <= xmax + 1e-9) pts.push([x, y]); }
            return pts.length >= 2 ? [pts[0], pts[pts.length - 1]] : null;
        };
        let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Fizibil bölge ve en iyi nokta" class="viz-svg">`;
        // grid and ticks
        for (let i = 0; i <= 4; i++) {
            const x = xmin + ((xmax - xmin) * i) / 4, y = ymin + ((ymax - ymin) * i) / 4;
            g += `<line x1="${sx(x)}" x2="${sx(x)}" y1="${M.t}" y2="${H - M.b}" stroke="var(--border)" stroke-width="0.6"/>`;
            g += `<line x1="${M.l}" x2="${W - M.r}" y1="${sy(y)}" y2="${sy(y)}" stroke="var(--border)" stroke-width="0.6"/>`;
            g += `<text x="${sx(x)}" y="${H - M.b + 15}" text-anchor="middle" class="viz-t">${f(x)}</text><text x="${M.l - 6}" y="${sy(y) + 4}" text-anchor="end" class="viz-t">${f(y)}</text>`;
        }
        const pts = poly.map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(" ");
        g += poly.length >= 3 ? `<polygon points="${pts}" fill="var(--teal-soft)" stroke="var(--teal)" stroke-width="1.5"/>` : `<polyline points="${pts}" fill="none" stroke="var(--teal)" stroke-width="3"/>`;
        // integer lattice
        const ints = problem.integer_vars || [];
        if (ints.includes(vx) && ints.includes(vy)) {
            const xs = [], span = (xmax - xmin) * (ymax - ymin);
            if (span <= 4000) for (let x = Math.ceil(xmin); x <= xmax; x++) for (let y = Math.ceil(ymin); y <= ymax; y++) {
                if (cons.every((k) => ok(k.c, x, y, k.a, k.b))) xs.push([x, y]);
            }
            xs.slice(0, 900).forEach(([x, y]) => (g += `<circle cx="${sx(x)}" cy="${sy(y)}" r="2" fill="var(--teal)" opacity=".55"/>`));
        }
        // constraint lines
        problem.constraints.forEach((c, i) => {
            const seg = clip(c.coeffs[vx] || 0, c.coeffs[vy] || 0, c.rhs);
            if (!seg) return;
            g += `<line x1="${sx(seg[0][0])}" y1="${sy(seg[0][1])}" x2="${sx(seg[1][0])}" y2="${sy(seg[1][1])}" stroke="var(--accent)" stroke-width="1.6"/>`;
            g += `<text x="${sx(seg[1][0]) - 4}" y="${sy(seg[1][1]) - 5}" text-anchor="end" class="viz-t" fill="var(--accent-dark)">(${i + 1})</text>`;
        });
        // objective iso-line through optimum + gradient
        const o1 = problem.objective[vx] || 0, o2 = problem.objective[vy] || 0;
        const iso = clip(o1, o2, o1 * opt[0] + o2 * opt[1]);
        if (iso) g += `<line x1="${sx(iso[0][0])}" y1="${sy(iso[0][1])}" x2="${sx(iso[1][0])}" y2="${sy(iso[1][1])}" stroke="var(--ink)" stroke-width="1.4" stroke-dasharray="5 4"/>`;
        const gl = Math.hypot(o1, o2) || 1, dir = problem.sense === "min" ? -1 : 1;
        const gx = (dir * o1) / gl, gy = (dir * o2) / gl;
        const x0 = sx(opt[0]), y0 = sy(opt[1]);
        g += `<line x1="${x0}" y1="${y0}" x2="${x0 + gx * 34}" y2="${y0 - gy * 34}" stroke="var(--ink)" stroke-width="1.6" marker-end="url(#vizArrow)"/>`;
        g += `<defs><marker id="vizArrow" markerWidth="8" markerHeight="8" refX="5" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="var(--ink)"/></marker></defs>`;
        g += `<circle cx="${x0}" cy="${y0}" r="6" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
        g += `<text x="${x0 + 10}" y="${y0 + 18}" class="viz-t viz-halo" fill="var(--ink)" font-weight="700">(${f(opt[0])}; ${f(opt[1])})</text>`;
        g += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle" class="viz-t">${esc(vx)}</text>`;
        g += `<text x="11" y="${(M.t + H - M.b) / 2}" transform="rotate(-90 11 ${(M.t + H - M.b) / 2})" text-anchor="middle" class="viz-t">${esc(vy)}</text></svg>`;
        const legend = `<div class="viz-legend"><span><i style="background:var(--teal-soft);border:1px solid var(--teal)"></i>fizibil bölge</span><span><i style="background:var(--accent)"></i>kısıtlar (numaralı)</span><span><i style="background:var(--ink)"></i>amaç doğrusu ve gradyan yönü</span><span><i style="background:var(--accent);border-radius:50%"></i>en iyi nokta</span></div>`;
        return figure("Doğrusal programlama: fizibil bölge ve en iyi nokta", g + legend);
    }

    function barFigure(vars, sol) {
        const vals = vars.map((v) => sol.variable_values[v] || 0), mx = Math.max(...vals, 1e-9);
        const bh = 26, h = vars.length * (bh + 8) + 20;
        let g = `<svg viewBox="0 0 ${W} ${h}" width="100%" role="img" aria-label="Karar değişkenleri" class="viz-svg">`;
        vars.forEach((v, i) => {
            const y = 10 + i * (bh + 8), w = ((W - 160) * vals[i]) / mx;
            g += `<text x="6" y="${y + 17}" class="viz-t">${esc(v)}</text><rect x="90" y="${y}" width="${Math.max(2, w)}" height="${bh}" rx="4" fill="var(--teal)"/><text x="${96 + w}" y="${y + 17}" class="viz-t">${f(vals[i])}</text>`;
        });
        return figure("Karar değişkenlerinin değerleri (üç ve daha fazla değişkende bölge çizilmez)", g + "</svg>");
    }

    // ---- queueing ----
    const erlangC = (c, a) => {
        let s = 0, t = 1;
        for (let n = 0; n < c; n++) { s += t; t = (t * a) / (n + 1); }
        const last = t / (1 - a / c);
        return last / (s + last);
    };
    const wqMMc = (lam, mu, c) => {
        const a = lam / mu, rho = a / c;
        if (rho >= 1) return null;
        return (erlangC(c, a) * rho / (1 - rho)) / lam;
    };

    function curve(series, o) {
        const xs = series.flatMap((s) => s.pts.map((p) => p[0])), ys = series.flatMap((s) => s.pts.map((p) => p[1]));
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y1 = Math.max(...ys) * 1.1 || 1;
        const sx = (x) => M.l + ((x - x0) / ((x1 - x0) || 1)) * (W - M.l - M.r), sy = (y) => H - M.b - (y / y1) * (H - M.t - M.b);
        let g = `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.label)}" class="viz-svg">`;
        for (let i = 0; i <= 4; i++) {
            const y = (y1 * i) / 4;
            g += `<line x1="${M.l}" x2="${W - M.r}" y1="${sy(y)}" y2="${sy(y)}" stroke="var(--border)" stroke-width="0.6"/><text x="${M.l - 6}" y="${sy(y) + 4}" text-anchor="end" class="viz-t">${f(y)}</text>`;
        }
        if (o.ticks) o.ticks.forEach((x) => (g += `<text x="${sx(x)}" y="${H - M.b + 15}" text-anchor="middle" class="viz-t">${f(x)}</text>`));
        series.forEach((s) => { g += `<polyline points="${s.pts.map((p) => sx(p[0]).toFixed(1) + "," + sy(p[1]).toFixed(1)).join(" ")}" fill="none" stroke="${s.color}" stroke-width="2.2"/>`; });
        if (o.mark) g += `<line x1="${sx(o.mark[0])}" x2="${sx(o.mark[0])}" y1="${M.t}" y2="${H - M.b}" stroke="var(--ink)" stroke-dasharray="4 4" stroke-width="1"/><circle cx="${sx(o.mark[0])}" cy="${sy(o.mark[1])}" r="6" fill="var(--accent)" stroke="var(--surface)" stroke-width="2"/>`;
        g += `<text x="${(M.l + W - M.r) / 2}" y="${H - 6}" text-anchor="middle" class="viz-t">${esc(o.xlabel)}</text><text x="11" y="${(M.t + H - M.b) / 2}" transform="rotate(-90 11 ${(M.t + H - M.b) / 2})" text-anchor="middle" class="viz-t">${esc(o.ylabel)}</text></svg>`;
        return g;
    }

    function queueFigure(p, r) {
        const rhoPct = Math.min(1, r.rho) * 100, bad = r.rho >= 1, col = r.rho > 0.85 ? "var(--accent)" : "var(--teal)";
        let g = `<div class="viz-gauge"><div class="viz-gauge-label">Kullanım oranı ρ = <b>${f(r.rho)}</b></div><div class="viz-gauge-track"><div style="width:${rhoPct}%;background:${col}"></div><span style="left:85%"></span></div><div class="viz-gauge-note">Çizgi: ρ = 0,85. Bunun üstünde bekleme süresi hızla büyür.</div></div>`;
        if (bad) return figure("Kuyruk: sistem kararsız", g);
        const lam = p.arrival_rate, mu = p.service_rate;
        if (p.model === "mmc" && p.servers > 1) {
            const c0 = Math.floor(lam / mu) + 1, cs = [];
            for (let c = c0; c <= Math.max(p.servers + 3, c0 + 5); c++) { const w = wqMMc(lam, mu, c); if (w !== null) cs.push([c, w]); }
            g += curve([{ pts: cs, color: "var(--teal)" }], { label: "Bekleme süresi, sunucu sayısına göre", xlabel: "sunucu sayısı c", ylabel: "ortalama kuyruk bekleme süresi Wq", ticks: cs.map((q) => q[0]), mark: [p.servers, r.Wq] });
            return figure("Kuyruk: sunucu eklemek beklemeyi nasıl düşürür", g);
        }
        const pts = [];
        for (let i = 1; i <= 96; i++) { const x = i / 100; pts.push([x, x / (1 - x)]); }
        const cap = 20, clipped = pts.filter((q) => q[1] <= cap);
        g += curve([{ pts: clipped, color: "var(--teal)" }], { label: "Sistemdeki ortalama sayı L, ρ'ya göre", xlabel: "kullanım oranı ρ", ylabel: "sistemdeki ortalama müşteri L", ticks: [0.2, 0.4, 0.6, 0.8, 0.95], mark: [r.rho, Math.min(r.L, cap)] });
        return figure("Kuyruk: ρ arttıkça sistemdeki müşteri sayısı hızla büyür", g);
    }

    function figure(title, body) { return `<div class="viz-card"><div class="viz-title">${esc(title)}</div>${body}</div>`; }

    window.OrViz = { lpFigure, queueFigure };
})();
