// Financial advisor chat for Financial Compass.
// The browser sends the figures, ratios, health score, saved periods and the active
// scenario it already calculated; the server asks an LLM to interpret exactly that.
// Nothing here recalculates anything: ratios come from hesaplaRasyolar (script.js).
(function () {
    const $ = id => document.getElementById(id);
    const API = new URL('../api/advisor/chat', location.href).href; // /ui/ -> /api, /finans/ui/ -> /finans/api
    const LEVER_NAMES = {
        sales: 'Net sales change (%)', gm: 'Gross margin change (pp)', opex: 'Operating expenses change (%)',
        kvb: 'Short-term debt change (%)', inv: 'Inventory change (%)', ar: 'Receivables change (%)',
    };
    const TREND_PRECISION = 4;

    const messages = [];
    let pending = false;

    const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const round = v => (v === null || v === undefined || isNaN(v)) ? null : +v.toFixed(TREND_PRECISION);

    // ─── context sent with every question ─────────────────
    function buildContext() {
        const full = FcScenario.currentFigures();
        const figures = Object.fromEntries(Object.entries(full).filter(([, v]) => v));
        const has = !!(figures.donenVarliklar || figures.toplamAktif || figures.netSatislar);
        const ctx = { figures, ratios: [], score: null, score_label: '', periods: [], scenario: null };
        if (has) {
            const r = FcScenario.ratiosOf(full, figures);
            const score = skorHesapla(hesaplaRasyolar(full));
            ctx.score = score;
            ctx.score_label = saglikDurumu(score).etiket;
            Object.entries(rasyoMeta).forEach(([key, meta]) => {
                const v = r[key];
                const verdict = v === null || v === undefined ? null : meta.yorum(v);
                ctx.ratios.push({
                    key, name: meta.ad, value: v === undefined ? null : v, display: formatVal(v, meta),
                    status: verdict ? verdict.durum : null, note: verdict ? verdict.mesaj : '',
                });
            });
        }
        const periods = FcScenario.getPeriods();
        if (periods.length >= 2) {
            ctx.periods = periods.map(p => {
                const pr = FcScenario.ratiosOf(p.data);
                return {
                    label: p.label, score: skorHesapla(hesaplaRasyolar(p.data)),
                    ratios: Object.fromEntries(Object.keys(rasyoMeta).map(k => [k, round(pr[k])])),
                };
            });
        }
        const sc = FcScenario.getScenario();
        if (sc && has) {
            ctx.scenario = {
                levers: Object.fromEntries(Object.entries(sc.levers).filter(([, v]) => v).map(([k, v]) => [LEVER_NAMES[k] || k, v])),
                base_score: sc.base_score, scenario_score: sc.scenario_score, warnings: sc.warnings.slice(0, 4),
            };
        }
        return { ctx, has };
    }

    // ─── rendering ────────────────────────────────────────
    // Minimal, escaped markdown: **bold**, *italic*, `code`, bullet / numbered lists, paragraphs.
    function md(text) {
        const out = []; let list = null;
        const flush = () => { if (list) { out.push(`<${list.tag}>${list.items.join('')}</${list.tag}>`); list = null; } };
        const inline = s => esc(s)
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(^|[^*])\*([^*\s](?:[^*]*[^*\s])?)\*(?!\*)/g, '$1<em>$2</em>');
        text.split(/\r?\n/).forEach(line => {
            const b = /^\s*[-*•]\s+(.*)/.exec(line), n = /^\s*\d+[.)]\s+(.*)/.exec(line);
            if (b || n) {
                const tag = b ? 'ul' : 'ol';
                if (list && list.tag !== tag) flush();
                list = list || { tag, items: [] };
                list.items.push(`<li>${inline((b || n)[1])}</li>`);
            } else {
                flush();
                if (line.trim()) out.push(`<p>${inline(line)}</p>`);
            }
        });
        flush();
        return out.join('');
    }

    function renderLog(error) {
        const log = $('advLog');
        if (!messages.length && !pending && !error) {
            log.innerHTML = '<div class="adv-empty">Ask about the figures you have entered: risks, strengths, what to improve, or how your periods and scenario compare.</div>';
            return;
        }
        log.innerHTML = messages.map(m =>
            `<div class="adv-msg adv-${m.role}"><div class="adv-bubble">${m.role === 'user' ? `<p>${esc(m.content)}</p>` : md(m.content)}</div></div>`).join('') +
            (pending ? '<div class="adv-msg adv-assistant"><div class="adv-bubble adv-typing" aria-label="Thinking"><i></i><i></i><i></i></div></div>' : '') +
            (error ? `<div class="adv-error" role="alert">${esc(error)}</div>` : '');
        log.scrollTop = log.scrollHeight;
    }

    function renderChips(has, ctx) {
        const chips = [
            ['What are my biggest risks?', has],
            ['Why is my health score what it is?', has],
            ['How can I improve liquidity?', has],
            ['Where does my ROE come from?', has],
            ['What changed across my periods?', ctx.periods.length >= 2],
            ['Comment on my scenario', !!ctx.scenario],
        ];
        $('advChips').innerHTML = chips.filter(c => c[1]).map(c => `<button type="button" class="adv-chip">${esc(c[0])}</button>`).join('');
    }

    function refresh() {
        const { ctx, has } = buildContext();
        const bits = has ? [`${Object.keys(ctx.figures).length} figures`] : ['no data yet'];
        if (ctx.periods.length) bits.push(`${ctx.periods.length} periods`);
        if (ctx.scenario) bits.push('scenario active');
        $('advContext').textContent = 'Using: ' + bits.join(' · ');
        $('advNoData').hidden = has;
        renderChips(has, ctx);
        $('advSend').disabled = pending || !has;
        $('advInput').disabled = !has;
    }

    // ─── sending ──────────────────────────────────────────
    async function send(text) {
        text = text.trim();
        if (!text || pending) return;
        const { ctx, has } = buildContext();
        if (!has) { showToast('Enter or load data first', 'error'); return; }
        messages.push({ role: 'user', content: text });
        $('advInput').value = '';
        pending = true; refresh(); renderLog();
        let error = null;
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 60000);
        try {
            const res = await fetch(API, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: ctl.signal,
                body: JSON.stringify({ messages: messages.slice(-8), context: ctx }),
            });
            if (!res.ok) {
                let detail = '';
                try { detail = (await res.json()).detail; } catch (e) { /* not JSON */ }
                throw new Error(typeof detail === 'string' && detail ? detail : `The advisor is unavailable (${res.status}).`);
            }
            messages.push({ role: 'assistant', content: (await res.json()).reply });
        } catch (e) {
            error = e.name === 'AbortError' ? 'The advisor took too long to answer. Please try again.' : e.message;
            messages.pop(); // the unanswered question stays out of the history
            $('advInput').value = text;
        } finally {
            clearTimeout(timer); pending = false; refresh(); renderLog(error);
        }
    }

    function init() {
        $('advForm').addEventListener('submit', e => { e.preventDefault(); send($('advInput').value); });
        $('advInput').addEventListener('keydown', e => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send($('advInput').value); }
        });
        $('advChips').addEventListener('click', e => { if (e.target.classList.contains('adv-chip')) send(e.target.textContent); });
        $('advClear').addEventListener('click', () => { messages.length = 0; renderLog(); });
        refresh(); renderLog();
    }

    window.FcAdvisor = { refresh, buildContext };
    init();
})();
