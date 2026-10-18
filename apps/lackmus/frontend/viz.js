// Pure-SVG visuals for Financial Compass: DuPont tree and ratio band strip.
// Input is the `rasyolar` object computed in script.js (values may be null).
window.FcViz = (function () {
    const NS = 'http://www.w3.org/2000/svg';
    const C = { ok: '#4ade80', warn: '#f59e0b', danger: '#ef4444', text: '#e8eaf0', text2: '#9ba3b8', line: '#2e3347', box: '#1e2332' };

    const pct = v => (v === null || v === undefined || isNaN(v)) ? 'N/A' : (v * 100).toFixed(1) + '%';
    const num = v => (v === null || v === undefined || isNaN(v)) ? 'N/A' : v.toFixed(2);

    function el(tag, attrs, text) {
        const e = document.createElementNS(NS, tag);
        Object.entries(attrs || {}).forEach(([k, v]) => e.setAttribute(k, v));
        if (text !== undefined) e.textContent = text;
        return e;
    }

    // ─── DuPont: ROE = net margin x asset turnover x leverage ───
    function dupont(host, r) {
        host.innerHTML = '';
        const W = 600, H = 250;
        const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fc-svg', role: 'img',
            'aria-label': 'DuPont decomposition of ROE' });
        const nm = r.netKarMarji, at = r.aktifDevir, lev = r.finansalKaldirac;
        const roeCalc = (nm !== null && at !== null && lev !== null) ? nm * at * lev : null;

        const box = (x, y, w, title, value, color) => {
            const g = el('g');
            g.appendChild(el('rect', { x, y, width: w, height: 58, rx: 10, fill: C.box, stroke: color, 'stroke-width': 1.6 }));
            g.appendChild(el('text', { x: x + w / 2, y: y + 21, 'text-anchor': 'middle', fill: C.text2, 'font-size': 12 }, title));
            g.appendChild(el('text', { x: x + w / 2, y: y + 45, 'text-anchor': 'middle', fill: C.text, 'font-size': 20, 'font-weight': 700 }, value));
            svg.appendChild(g);
        };
        const link = (x1, y1, x2, y2) => svg.appendChild(el('path',
            { d: `M${x1} ${y1} C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2}`, fill: 'none', stroke: C.line, 'stroke-width': 2 }));
        const op = (x, y, t) => svg.appendChild(el('text', { x, y, 'text-anchor': 'middle', fill: C.text2, 'font-size': 22 }, t));

        const roeColor = roeCalc === null ? C.line : roeCalc >= 0.15 ? C.ok : roeCalc >= 0.05 ? C.warn : C.danger;
        box(220, 8, 160, 'ROE', pct(roeCalc), roeColor);
        [[110, 'Net profit margin', pct(nm), '= NI / Sales'],
         [300, 'Asset turnover', num(at) + '\u00d7', '= Sales / Assets'],
         [490, 'Leverage', num(lev) + '\u00d7', '= Assets / Equity']].forEach(([cx, t, v, f], i) => {
            link(300, 66, cx, 130);
            box(cx - 80, 130, 160, t, v, nm === null ? C.line : C.ok);
            svg.appendChild(el('text', { x: cx, y: 210, 'text-anchor': 'middle', fill: C.text2, 'font-size': 11 }, f));
            if (i < 2) op(cx + 95, 166, '\u00d7');
        });
        svg.appendChild(el('text', { x: 300, y: 238, 'text-anchor': 'middle', fill: C.text2, 'font-size': 12 },
            roeCalc === null ? 'Not enough data for the decomposition'
                : 'Raise ROE through margin (profitability), turnover (efficiency) or leverage (risk).'));
        host.appendChild(svg);
    }

    // ─── Band strip: each ratio on a bad / watch / good scale ───
    // [key, label, min, max, bad→good boundaries, higherIsBetter, formatter]
    const BANDS = [
        ['cariOran', 'Current ratio', 0, 3, 1, 1.5, true, num],
        ['asitTest', 'Acid-test', 0, 2, 0.7, 1, true, num],
        ['borcOzkaynak', 'Debt / equity', 0, 4, 1.5, 2.5, false, num],
        ['borcAktif', 'Debt ratio', 0, 1, 0.5, 0.6, false, pct],
        ['netKarMarji', 'Net margin', 0, 0.3, 0.05, 0.1, true, pct],
        ['roe', 'ROE', 0, 0.4, 0.08, 0.15, true, pct],
        ['aktifDevir', 'Asset turnover', 0, 3, 0.5, 1, true, num],
    ];

    function bands(host, r) {
        host.innerHTML = '';
        const rowH = 38, top = 8, L = 120, R = 70, W = 600;
        const H = top + BANDS.length * rowH + 6;
        const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'fc-svg', role: 'img',
            'aria-label': 'Ratios placed on bad, watch and good bands' });
        const bw = W - L - R;
        BANDS.forEach(([key, label, min, max, b1, b2, hib, fmt], i) => {
            const y = top + i * rowH;
            const x = v => L + Math.max(0, Math.min(1, (v - min) / (max - min))) * bw;
            const segs = hib
                ? [[min, b1, C.danger], [b1, b2, C.warn], [b2, max, C.ok]]
                : [[min, b1, C.ok], [b1, b2, C.warn], [b2, max, C.danger]];
            svg.appendChild(el('text', { x: L - 10, y: y + 17, 'text-anchor': 'end', fill: C.text2, 'font-size': 12 }, label));
            segs.forEach(([a, b, c]) => svg.appendChild(el('rect',
                { x: x(a), y: y + 6, width: Math.max(0, x(b) - x(a)), height: 14, fill: c, opacity: 0.28, rx: 3 })));
            const v = r[key];
            if (v === null || v === undefined || isNaN(v)) {
                svg.appendChild(el('text', { x: L + bw + 10, y: y + 17, fill: C.text2, 'font-size': 12 }, 'N/A'));
                return;
            }
            const good = hib ? v >= b2 : v <= b1;
            const bad = hib ? v < b1 : v > b2;
            const col = good ? C.ok : bad ? C.danger : C.warn;
            svg.appendChild(el('path', { d: `M${x(v)} ${y + 3} l-6 -3 h12 z`, fill: col }));
            svg.appendChild(el('rect', { x: x(v) - 2, y: y + 3, width: 4, height: 20, fill: col, rx: 2 }));
            svg.appendChild(el('text', { x: L + bw + 10, y: y + 17, fill: C.text, 'font-size': 12, 'font-weight': 700 }, fmt(v)));
        });
        host.appendChild(svg);
    }

    return { dupont, bands };
})();
