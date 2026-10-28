// Trends & Scenarios for Financial Compass.
// Periods are snapshots of the Data Entry figures kept in localStorage; the
// scenario view re-runs the same ratio maths (hesaplaRasyolar) on adjusted figures.
// Everything is deterministic, client-side arithmetic: no model, no forecast.
(function () {
    const KEY = 'fc-periods';
    const MAX_PERIODS = 6;
    const SKIP = new Set(['hisseFiyati', 'eps']);
    // Ratios where a lower value is the healthier direction; fd (P/E) is left neutral.
    const LOWER_BETTER = new Set(['borcOzkaynak', 'borcAktif', 'finansalKaldirac']);
    const NEUTRAL = new Set(['fd']);

    let periods = load();

    function load() {
        try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch (e) { return []; }
    }
    function save() {
        try { localStorage.setItem(KEY, JSON.stringify(periods)); } catch (e) { /* private mode */ }
    }
    const $ = id => document.getElementById(id);
    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    function currentFigures() {
        return Object.fromEntries(VERI_ALANLARI.map(f => [f, g(f)]));
    }
    const hasData = v => !!(v.donenVarliklar || v.toplamAktif || v.netSatislar);

    function fmt(key, v) {
        return formatVal(v, rasyoMeta[key] || {});
    }
    // Sign of the change as good/bad for this ratio, or '' when neutral/unknown.
    function tone(key, from, to) {
        if (from === null || to === null || from === undefined || to === undefined || NEUTRAL.has(key)) return '';
        const d = to - from;
        if (Math.abs(d) < 1e-9) return '';
        return (LOWER_BETTER.has(key) ? d < 0 : d > 0) ? 'ok' : 'danger';
    }
    function deltaText(key, from, to) {
        if (from === null || to === null || from === undefined || to === undefined) return '–';
        const d = to - from;
        const sign = d > 0 ? '+' : d < 0 ? '−' : '';
        const a = Math.abs(d);
        const pctMeta = (rasyoMeta[key] || {}).format === 'percent';
        return sign + (pctMeta ? (a * 100).toFixed(1) + ' pp' : a.toFixed(2));
    }

    function spark(values) {
        const pts = values.map((v, i) => [i, v]).filter(p => p[1] !== null && p[1] !== undefined && !isNaN(p[1]));
        if (pts.length < 2) return '';
        const W = 84, H = 24, min = Math.min(...pts.map(p => p[1])), max = Math.max(...pts.map(p => p[1]));
        const span = max - min || 1, n = values.length - 1 || 1;
        const xy = pts.map(p => [(p[0] / n) * (W - 6) + 3, H - 4 - ((p[1] - min) / span) * (H - 8)]);
        const last = xy[xy.length - 1];
        return `<svg class="sc-spark" viewBox="0 0 ${W} ${H}" aria-hidden="true"><polyline points="${xy.map(p => p.join(',')).join(' ')}" fill="none" stroke="var(--accent)" stroke-width="1.6"/><circle cx="${last[0]}" cy="${last[1]}" r="2.4" fill="var(--accent)"/></svg>`;
    }

    // ─── PERIODS + TREND ───────────────────────────────
    function renderPeriods() {
        $('scPeriodList').innerHTML = periods.length
            ? periods.map((p, i) => `<span class="sc-chip">${esc(p.label)}<button type="button" data-del="${i}" aria-label="Remove ${esc(p.label)}">×</button></span>`).join('')
            : '<span class="sc-muted">No periods saved yet.</span>';
        renderTrend();
        fillBaseSelect();
    }

    function renderTrend() {
        const host = $('scTrend');
        if (periods.length < 2) {
            host.innerHTML = '<div class="sc-empty">Save at least two periods (for example FY2024 and FY2025) to see how each ratio moves.</div>';
            return;
        }
        const rs = periods.map(p => hesaplaRasyolar(p.data));
        const scores = rs.map(skorHesapla);
        const keys = Object.keys(rasyoMeta).filter(k => !SKIP.has(k));
        const head = `<tr><th>Ratio</th>${periods.map(p => `<th>${esc(p.label)}</th>`).join('')}<th>Trend</th><th>Δ first→last</th></tr>`;
        const scoreRow = `<tr class="sc-score"><td>Health score</td>${scores.map(s => `<td>${s}</td>`).join('')}<td>${spark(scores)}</td>` +
            `<td class="${scores[scores.length - 1] >= scores[0] ? 'sc-ok' : 'sc-bad'}">${scores[scores.length - 1] - scores[0] >= 0 ? '+' : '−'}${Math.abs(scores[scores.length - 1] - scores[0])}</td></tr>`;
        const rows = keys.map(k => {
            const series = rs.map(r => r[k]);
            const t = tone(k, series[0], series[series.length - 1]);
            return `<tr><td>${esc(rasyoMeta[k].ad)}</td>${series.map(v => `<td>${fmt(k, v)}</td>`).join('')}<td>${spark(series)}</td>` +
                `<td class="${t === 'ok' ? 'sc-ok' : t === 'danger' ? 'sc-bad' : ''}">${deltaText(k, series[0], series[series.length - 1])}</td></tr>`;
        }).join('');
        host.innerHTML = `<div class="sc-table-wrap"><table class="sc-table"><thead>${head}</thead><tbody>${scoreRow}${rows}</tbody></table></div>` +
            '<p class="sc-note">Green means the move is healthier for that ratio, red means weaker. P/E is shown without a verdict.</p>';
    }

    function addPeriod() {
        const label = $('scLabel').value.trim();
        const data = currentFigures();
        if (!hasData(data)) { showToast('Enter data first, then save it as a period', 'error'); return; }
        if (!label) { showToast('Give the period a label, e.g. FY2025', 'error'); return; }
        if (periods.length >= MAX_PERIODS) { showToast(`At most ${MAX_PERIODS} periods`, 'error'); return; }
        periods = periods.filter(p => p.label !== label).concat([{ label, data }]);
        $('scLabel').value = '';
        save(); renderPeriods();
        showToast(`Saved ${label}`, 'success');
    }

    // Illustrative three-year history around the built-in sample company.
    function loadSampleHistory() {
        const y = (label, f) => ({
            label,
            data: {
                donenVarliklar: 850000 * f.dv, stoklar: 220000 * f.st, nakit: 180000 * f.cash, toplamAktif: 2100000 * f.ta,
                kisaVadeliBorclar: 420000 * f.kvb, uzunVadeliBorclar: 380000 * f.uvb, toplamBorclar: 420000 * f.kvb + 380000 * f.uvb,
                ozkaynak: 2100000 * f.ta - (420000 * f.kvb + 380000 * f.uvb), netSatislar: 3200000 * f.ns, brutKar: 3200000 * f.ns * f.gm,
                faaliyetKari: 3200000 * f.ns * f.om, netKar: 3200000 * f.ns * f.nm, alacaklar: 310000 * f.ar, faizGiderleri: 52000 * f.int,
                eps: 3.4 * f.nm * f.ns / 0.10625, hisseFiyati: 42,
            },
        });
        const round = p => { Object.keys(p.data).forEach(k => { p.data[k] = k === 'eps' ? Math.round(p.data[k] * 100) / 100 : Math.round(p.data[k]); }); return p; };
        periods = [
            y('FY2023', { dv: 0.78, st: 0.85, cash: 0.82, ta: 0.86, kvb: 0.9, uvb: 1.2, ns: 0.84, gm: 0.28, om: 0.12, nm: 0.07, ar: 0.92, int: 1.15 }),
            y('FY2024', { dv: 0.9, st: 1.1, cash: 0.9, ta: 0.95, kvb: 1.1, uvb: 1.1, ns: 0.93, gm: 0.29, om: 0.14, nm: 0.09, ar: 1.05, int: 1.08 }),
            y('FY2025', { dv: 1, st: 1, cash: 1, ta: 1, kvb: 1, uvb: 1, ns: 1, gm: 0.30, om: 0.15, nm: 0.10625, ar: 1, int: 1 }),
        ].map(round);
        save(); renderPeriods();
        showToast('Illustrative sample history loaded', 'success');
    }

    // ─── SCENARIO ──────────────────────────────────────
    const LEVERS = [
        { id: 'sales', label: 'Net sales', unit: '%', min: -40, max: 40 },
        { id: 'gm', label: 'Gross margin', unit: ' pp', min: -10, max: 10 },
        { id: 'opex', label: 'Operating expenses', unit: '%', min: -30, max: 30 },
        { id: 'kvb', label: 'Short-term debt', unit: '%', min: -50, max: 50 },
        { id: 'inv', label: 'Inventory', unit: '%', min: -50, max: 50 },
        { id: 'ar', label: 'Receivables', unit: '%', min: -50, max: 50 },
    ];
    const PRESETS = {
        downturn: { label: 'Downturn', v: { sales: -15, gm: -2, opex: -3, kvb: 10, inv: 10, ar: 10 } },
        squeeze: { label: 'Margin squeeze', v: { sales: 0, gm: -4, opex: 8, kvb: 0, inv: 0, ar: 0 } },
        delever: { label: 'Pay down debt', v: { sales: 0, gm: 0, opex: 0, kvb: -30, inv: 0, ar: 0 } },
        growth: { label: 'Growth', v: { sales: 15, gm: 1, opex: 8, kvb: 10, inv: 15, ar: 15 } },
    };

    function fillBaseSelect() {
        const sel = $('scBase'); const prev = sel.value;
        sel.innerHTML = '<option value="cur">Current data (Data Entry)</option>' +
            periods.map((p, i) => `<option value="${i}">${esc(p.label)}</option>`).join('');
        sel.value = [...sel.options].some(o => o.value === prev) ? prev : 'cur';
    }

    function baseFigures() {
        const v = $('scBase').value;
        return v === 'cur' ? currentFigures() : (periods[+v] || {}).data || {};
    }

    // Applies the levers; the balance sheet stays balanced by construction:
    // d(assets) = d(net income) + d(debt) = d(equity) + d(liabilities).
    function applyScenario(b, L) {
        const n = x => x || 0;
        const ns = n(b.netSatislar) * (1 + L.sales / 100);
        const gmBase = b.netSatislar ? n(b.brutKar) / b.netSatislar : 0;
        const bk = ns * (gmBase + L.gm / 100);
        const opexBase = n(b.brutKar) - n(b.faaliyetKari);
        const fk = bk - opexBase * (1 + L.opex / 100);
        const faiz = n(b.faizGiderleri);
        const preBase = n(b.faaliyetKari) - faiz;
        const keep = preBase > 0 ? Math.min(1, Math.max(0, n(b.netKar) / preBase)) : 1;
        const pre = fk - faiz;
        const nk = pre > 0 ? pre * keep : pre;

        const kvb = n(b.kisaVadeliBorclar) * (1 + L.kvb / 100);
        const stok = n(b.stoklar) * (1 + L.inv / 100);
        const al = n(b.alacaklar) * (1 + L.ar / 100);
        const dNk = nk - n(b.netKar), dDebt = kvb - n(b.kisaVadeliBorclar);
        const dStok = stok - n(b.stoklar), dAl = al - n(b.alacaklar);
        const nakit = n(b.nakit) + dNk + dDebt - dStok - dAl;
        const dv = n(b.donenVarliklar) + (nakit - n(b.nakit)) + dStok + dAl;
        return {
            figures: Object.assign({}, b, {
                netSatislar: ns, brutKar: bk, faaliyetKari: fk, netKar: nk,
                kisaVadeliBorclar: kvb, toplamBorclar: n(b.toplamBorclar) + dDebt,
                stoklar: stok, alacaklar: al, nakit, donenVarliklar: dv,
                toplamAktif: n(b.toplamAktif) + dNk + dDebt, ozkaynak: n(b.ozkaynak) + dNk,
                eps: n(b.netKar) > 0 && n(b.eps) ? n(b.eps) * nk / b.netKar : n(b.eps),
            }),
            nakit,
        };
    }

    function readLevers() {
        return Object.fromEntries(LEVERS.map(l => [l.id, parseFloat($('sc_' + l.id).value) || 0]));
    }

    function renderScenario() {
        const L = readLevers();
        LEVERS.forEach(l => { $('scv_' + l.id).textContent = (L[l.id] > 0 ? '+' : '') + L[l.id] + l.unit; });
        const host = $('scResult');
        const b = baseFigures();
        if (!hasData(b)) {
            host.innerHTML = '<div class="sc-empty">Load or enter data first (Data Entry), then move the sliders.</div>';
            return;
        }
        const out = applyScenario(b, L);
        const r0 = hesaplaRasyolar(b), r1 = hesaplaRasyolar(out.figures);
        const s0 = skorHesapla(r0), s1 = skorHesapla(r1);
        const keys = Object.keys(rasyoMeta).filter(k => !SKIP.has(k));
        const rows = keys.map(k => {
            const t = tone(k, r0[k], r1[k]);
            const verdict = r1[k] === null ? null : rasyoMeta[k].yorum(r1[k]);
            return `<tr><td>${esc(rasyoMeta[k].ad)}</td><td>${fmt(k, r0[k])}</td><td class="${verdict ? 'sc-' + verdict.durum : ''}">${fmt(k, r1[k])}</td>` +
                `<td class="${t === 'ok' ? 'sc-ok' : t === 'danger' ? 'sc-bad' : ''}">${deltaText(k, r0[k], r1[k])}</td></tr>`;
        }).join('');
        const warnings = [];
        if (out.nakit < 0) warnings.push('Cash turns negative: the scenario needs extra financing.');
        if (out.figures.ozkaynak <= 0) warnings.push('Equity is zero or negative: leverage ratios are not meaningful.');
        if (out.figures.netKar < 0) warnings.push('The scenario produces a net loss.');
        const st0 = saglikDurumu(s0), st1 = saglikDurumu(s1), d = s1 - s0;
        host.innerHTML = `
            <div class="sc-scorebar">
                <div><span class="sc-k">Base</span><strong>${s0}</strong><em>${st0.etiket}</em></div>
                <div class="sc-arrow">→</div>
                <div><span class="sc-k">Scenario</span><strong class="sc-${st1.durum}">${s1}</strong><em>${st1.etiket}</em></div>
                <div class="${d >= 0 ? 'sc-ok' : 'sc-bad'}"><span class="sc-k">Change</span><strong>${d > 0 ? '+' : d < 0 ? '−' : ''}${Math.abs(d)}</strong><em>points</em></div>
            </div>
            ${warnings.map(w => `<div class="sc-alert">${w}</div>`).join('')}
            <div class="sc-table-wrap"><table class="sc-table"><thead><tr><th>Ratio</th><th>Base</th><th>Scenario</th><th>Δ</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    }

    function init() {
        $('scSave').addEventListener('click', addPeriod);
        $('scSample').addEventListener('click', loadSampleHistory);
        $('scClear').addEventListener('click', () => { periods = []; save(); renderPeriods(); renderScenario(); });
        $('scPeriodList').addEventListener('click', e => {
            const i = e.target.dataset && e.target.dataset.del;
            if (i === undefined) return;
            periods.splice(+i, 1); save(); renderPeriods(); renderScenario();
        });
        $('scLevers').innerHTML = LEVERS.map(l => `
            <div class="sc-lever"><label for="sc_${l.id}">${l.label}<output id="scv_${l.id}">0${l.unit}</output></label>
            <input type="range" id="sc_${l.id}" min="${l.min}" max="${l.max}" step="1" value="0"></div>`).join('');
        $('scPresets').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button type="button" class="btn-secondary btn-sm" data-preset="${k}">${p.label}</button>`).join('') +
            '<button type="button" class="btn-ghost btn-sm" data-preset="reset">Reset</button>';
        $('scLevers').addEventListener('input', renderScenario);
        $('scBase').addEventListener('change', renderScenario);
        $('scPresets').addEventListener('click', e => {
            const k = e.target.dataset && e.target.dataset.preset;
            if (!k) return;
            const v = k === 'reset' ? {} : PRESETS[k].v;
            LEVERS.forEach(l => { $('sc_' + l.id).value = v[l.id] || 0; });
            renderScenario();
        });
        renderPeriods();
        renderScenario();
    }

    // Re-render when the section opens so it reflects the latest Data Entry figures.
    window.FcScenario = { refresh() { renderTrend(); renderScenario(); }, applyScenario, currentFigures };
    init();
})();
