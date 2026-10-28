/* =============================================
   FINANCIAL COMPASS — script.js
   Internal identifiers (field ids, object keys like
   "cariOran"/"donenVarliklar") are left as-is on purpose -
   they're plumbing, not user-facing text, and renaming them
   would touch every line of this file for zero visible benefit.
   Only the DISPLAYED strings are translated to English.
   ============================================= */

// ─── DESIGN TOKENS ────────────────────────────────
// Read from style.css once, so every chart uses the same palette as the UI.
function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

const TOKENS = {
    accent: cssVar('--accent') || '#4ade80',
    accent2: cssVar('--accent2') || '#22c55e',
    warn: cssVar('--warn') || '#f59e0b',
    danger: cssVar('--danger') || '#ef4444',
    info: cssVar('--info') || '#60a5fa',
    text: cssVar('--text') || '#e9ecf4',
    text2: cssVar('--text2') || '#98a1b8',
    text3: cssVar('--text3') || '#5d667e',
    grid: cssVar('--border') || '#262c3d',
    track: cssVar('--bg3') || '#151a26',
    surface: cssVar('--surface') || '#141824',
};

function withAlpha(hex, a) {
    const h = hex.replace('#', '');
    const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
    const n = parseInt(full, 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ─── STATE ────────────────────────────────────────
let veri = {};
let rasyolar = {};
let chartInstances = {};
let analizYapildi = false;
let saglikSkoru = null;

// ─── NAV ──────────────────────────────────────────
const sidebarEl = document.getElementById('sidebar');
const backdropEl = document.getElementById('sidebarBackdrop');

function closeMobileNav() {
    sidebarEl.classList.remove('open');
    backdropEl.hidden = true;
}

function showSection(id) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const sec = document.getElementById('section-' + id);
    if (sec) sec.classList.add('active');

    const nav = document.querySelector(`[data-section="${id}"]`);
    if (nav) nav.classList.add('active');

    const titles = {
        dashboard: 'Dashboard',
        input: 'Data Entry',
        ratios: 'Ratio Analysis',
        charts: 'Charts',
        report: 'Report',
        glossary: 'Glossary of Terms'
    };
    document.getElementById('pageTitle').textContent = titles[id] || id;

    if (window.innerWidth <= 900) closeMobileNav();
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        showSection(item.dataset.section);
    });
});

document.getElementById('menuToggle').addEventListener('click', () => {
    sidebarEl.classList.add('open');
    backdropEl.hidden = false;
});
backdropEl.addEventListener('click', closeMobileNav);

// Collapsible sidebar (desktop), persisted across sessions
const collapseBtn = document.getElementById('sidebarCollapse');
function applyNavState() {
    const collapsed = localStorage.getItem('fc-nav') === '1';
    document.body.classList.toggle('nav-collapsed', collapsed);
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
}
collapseBtn.addEventListener('click', () => {
    const collapsed = document.body.classList.toggle('nav-collapsed');
    localStorage.setItem('fc-nav', collapsed ? '1' : '0');
    collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    Object.values(chartInstances).forEach(c => c.resize());
});
applyNavState();

// ─── TABS ──────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const parent = tab.closest('.tabs');
        parent.querySelectorAll('.tab').forEach(t => {
            t.classList.remove('active');
            t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');
        const tabId = tab.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(tc => {
            tc.classList.toggle('active', tc.id === 'tab-' + tabId);
        });
    });
});

// ─── FILE UPLOAD (CSV/JSON) ────────────────────────
const uploadArea = document.getElementById('uploadArea');
const fileInput = document.getElementById('fileInput');

uploadArea.addEventListener('dragover', e => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
uploadArea.addEventListener('drop', e => {
    e.preventDefault();
    uploadArea.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) isleDosya(f);
});

fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) isleDosya(fileInput.files[0]);
});

function isleDosya(f) {
    const ext = f.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    reader.onload = (e) => {
        try {
            if (ext === 'json') {
                const json = JSON.parse(e.target.result);
                veriUygula(json);
            } else if (ext === 'csv') {
                const result = Papa.parse(e.target.result.trim(), { header: false, skipEmptyLines: true });
                const obj = {};
                result.data.forEach(row => {
                    if (row.length >= 2) {
                        const key = row[0].trim();
                        const val = parseFloat(row[1]);
                        if (key && !isNaN(val)) obj[key] = val;
                    }
                });
                veriUygula(obj);
            } else {
                showToast('Unsupported file format', 'error');
            }
        } catch (err) {
            showToast('File read error: ' + err.message, 'error');
        }
    };
    reader.readAsText(f);
}

function veriUygula(obj) {
    veri = obj;
    const preview = document.getElementById('csvPreview');
    preview.classList.remove('hidden');
    const keys = Object.keys(obj);
    preview.innerHTML = `✓ ${keys.length} field(s) loaded: ${keys.join(', ')}`;

    // Fill form fields
    const fields = ['donenVarliklar','stoklar','nakit','toplamAktif','kisaVadeliBorclar',
        'uzunVadeliBorclar','toplamBorclar','ozkaynak','netSatislar','brutKar',
        'faaliyetKari','netKar','alacaklar','faizGiderleri','eps','hisseFiyati'];
    fields.forEach(f => {
        const el = document.getElementById(f);
        if (el && obj[f] !== undefined) el.value = obj[f];
    });

    showToast(`${Object.keys(obj).length} field(s) loaded successfully ✓`, 'success');
    hesapla();
}

// ─── DOCUMENT UPLOAD (PDF / image, parsed server-side) ─
const docUploadArea = document.getElementById('docUploadArea');
const docFileInput = document.getElementById('docFileInput');
const docStatus = document.getElementById('docStatus');

docUploadArea.addEventListener('dragover', e => { e.preventDefault(); docUploadArea.classList.add('drag-over'); });
docUploadArea.addEventListener('dragleave', () => docUploadArea.classList.remove('drag-over'));
docUploadArea.addEventListener('drop', e => {
    e.preventDefault();
    docUploadArea.classList.remove('drag-over');
    const f = e.dataTransfer.files[0];
    if (f) isleBelge(f);
});

docFileInput.addEventListener('change', () => {
    if (docFileInput.files[0]) isleBelge(docFileInput.files[0]);
});

async function isleBelge(f) {
    docStatus.classList.remove('hidden');
    docStatus.textContent = `Reading ${f.name} - this can take 10-40s (the file is sent to an AI model to extract the numbers)...`;

    const formData = new FormData();
    formData.append('file', f);

    try {
        const res = await fetch('/finans/api/extract-balance-sheet', { method: 'POST', body: formData });
        if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.detail || `Server error (${res.status})`);
        }
        const data = await res.json();
        const extracted = data.fields || {};
        const keys = Object.keys(extracted);
        if (!keys.length) {
            docStatus.textContent = `⚠ No recognizable balance-sheet fields found in ${f.name}. Try manual entry instead.`;
            showToast('No fields extracted from document', 'error');
            return;
        }
        docStatus.innerHTML = `✓ ${keys.length} field(s) extracted from ${f.name}: ${keys.join(', ')}` +
            `<br><span style="color:var(--warn)">⚠ AI-extracted from the document image/text - please verify these numbers against the original before trusting the analysis.</span>`;
        veriUygula(extracted);
        showSection('ratios');
    } catch (err) {
        docStatus.textContent = '✗ Extraction failed: ' + err.message;
        showToast('Document extraction failed: ' + err.message, 'error');
    }
}

// ─── SAMPLE DATA ────────────────────────────────────
function ornekVeriYukle() {
    const ornek = {
        donenVarliklar: 850000,
        stoklar: 220000,
        nakit: 180000,
        toplamAktif: 2100000,
        kisaVadeliBorclar: 420000,
        uzunVadeliBorclar: 380000,
        toplamBorclar: 800000,
        ozkaynak: 1300000,
        netSatislar: 3200000,
        brutKar: 960000,
        faaliyetKari: 480000,
        netKar: 340000,
        alacaklar: 310000,
        faizGiderleri: 52000,
        eps: 3.4,
        hisseFiyati: 42
    };
    veriUygula(ornek);
    showSection('ratios');
}

function formuSifirla() {
    const fields = ['donenVarliklar','stoklar','nakit','toplamAktif','kisaVadeliBorclar',
        'uzunVadeliBorclar','toplamBorclar','ozkaynak','netSatislar','brutKar',
        'faaliyetKari','netKar','alacaklar','faizGiderleri','eps','hisseFiyati'];
    fields.forEach(f => { const el = document.getElementById(f); if (el) el.value = ''; });
    veri = {}; rasyolar = {}; analizYapildi = false; saglikSkoru = null;
    document.getElementById('noDataMsg').classList.remove('hidden');
    document.getElementById('ratioResults').classList.add('hidden');
    document.getElementById('noDataMsgChart').classList.remove('hidden');
    document.getElementById('chartResults').classList.add('hidden');
    document.getElementById('noDataMsgReport').classList.remove('hidden');
    document.getElementById('reportContent').classList.add('hidden');
    document.getElementById('ratioSummary').hidden = true;
    document.getElementById('balanceCheck').hidden = true;
    updateKPIs(null);
    updateStatus(null);
    renderHealthScore();
    renderScoreBreakdown();
    renderStructure();
    renderVerdicts();
    showToast('Data cleared', 'success');
}

// ─── READ DATA ────────────────────────────────────
function g(id) {
    const v = veri[id] !== undefined ? veri[id] : parseFloat(document.getElementById(id)?.value || '0');
    return isNaN(v) ? 0 : v;
}

function safe(num, den) {
    if (!den || den === 0) return null;
    return num / den;
}

// ─── CALCULATE ───────────────────────────────────────
function hesapla() {
    const dv = g('donenVarliklar');
    const stok = g('stoklar');
    const nakit = g('nakit');
    const ta = g('toplamAktif');
    const kvb = g('kisaVadeliBorclar');
    const uvb = g('uzunVadeliBorclar');
    const tb = g('toplamBorclar');
    const oz = g('ozkaynak');
    const ns = g('netSatislar');
    const bk = g('brutKar');
    const fk = g('faaliyetKari');
    const nk = g('netKar');
    const al = g('alacaklar');
    const faiz = g('faizGiderleri');
    const eps = g('eps');
    const hp = g('hisseFiyati');

    if (!dv && !ta && !ns) {
        showToast('Please enter data first', 'error');
        return;
    }

    rasyolar = {
        // Liquidity
        cariOran: safe(dv, kvb),
        asitTest: safe(dv - stok, kvb),
        nakitOrani: safe(nakit, kvb),

        // Leverage
        borcOzkaynak: safe(tb, oz),
        finansalKaldirac: safe(ta, oz),
        borcAktif: safe(tb, ta),
        faizKarsilama: faiz ? safe(fk, faiz) : null,

        // Profitability
        brutKarMarji: safe(bk, ns),
        faaliyetKarMarji: safe(fk, ns),
        netKarMarji: safe(nk, ns),
        roe: safe(nk, oz),
        roa: safe(nk, ta),

        // Activity
        aktifDevir: safe(ns, ta),
        alacakDevir: al ? safe(ns, al) : null,
        stokDevir: stok ? safe(ns, stok) : null,

        // Market
        fd: (eps && hp) ? safe(hp, eps) : null,
        hisseFiyati: hp,
        eps: eps,
    };

    analizYapildi = true;

    const skorBilesenleri = [
        normalize(rasyolar.cariOran, 0, 3),
        normalize(rasyolar.asitTest, 0, 2),
        normalize(rasyolar.netKarMarji, 0, 0.3),
        normalize(rasyolar.roe, 0, 0.3),
        normalize(rasyolar.aktifDevir, 0, 3),
        normalize(2 - (rasyolar.borcOzkaynak !== null ? rasyolar.borcOzkaynak : 2), 0, 2),
    ];
    saglikSkoru = Math.round(skorBilesenleri.reduce((a, b) => a + b, 0) / skorBilesenleri.length * 100);

    renderRatios();
    renderKPIs();
    renderScoreBreakdown();
    renderStructure();
    renderCharts();
    renderVerdicts();
    renderHealthScore();
    renderReport();
    renderBalanceCheck();
    updateStatus(true);
    showToast('Analysis complete ✓', 'success');
}

// ─── HEALTH SCORE ──────────────────────────────────
function normalize(v, min, max) {
    if (v === null || v === undefined) return 0;
    return Math.min(1, Math.max(0, (v - min) / (max - min)));
}

function saglikDurumu(skor) {
    if (skor >= 80) return { durum: 'ok', etiket: 'Excellent' };
    if (skor >= 60) return { durum: 'ok', etiket: 'Good' };
    if (skor >= 40) return { durum: 'warn', etiket: 'Fair' };
    if (skor >= 20) return { durum: 'warn', etiket: 'Weak' };
    return { durum: 'danger', etiket: 'Critical' };
}

// Animated counter (skipped when the user prefers reduced motion)
function countUp(el, target, format) {
    if (!el) return;
    const fmt = format || (v => v.toFixed(2));
    if (target === null || target === undefined || isNaN(target)) { el.textContent = '—'; return; }
    if (prefersReducedMotion()) { el.textContent = fmt(target); return; }
    const start = performance.now();
    const dur = 700;
    function step(now) {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = fmt(target * eased);
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = fmt(target);
    }
    requestAnimationFrame(step);
}

function renderHealthScore() {
    const numberEl = document.getElementById('scoreNumber');
    const labelEl = document.getElementById('scoreLabel');
    destroyChart('chartHealthScore');
    const ctx = document.getElementById('chartHealthScore').getContext('2d');

    if (saglikSkoru === null) {
        numberEl.textContent = '—';
        numberEl.style.color = 'var(--text)';
        labelEl.textContent = 'Awaiting data';
        chartInstances.chartHealthScore = new Chart(ctx, {
            type: 'doughnut',
            data: { datasets: [{ data: [100], backgroundColor: ['#2e3347'], borderWidth: 0 }] },
            options: {
                rotation: -90, circumference: 180, cutout: '78%', maintainAspectRatio: false,
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                animation: false,
            }
        });
        return;
    }

    const { durum, etiket } = saglikDurumu(saglikSkoru);
    const colorMap = { ok: CHART_COLORS.ok, warn: CHART_COLORS.warn, danger: CHART_COLORS.danger };

    numberEl.style.color = colorMap[durum];
    countUp(numberEl, saglikSkoru, v => String(Math.round(v)));
    labelEl.textContent = etiket;

    chartInstances.chartHealthScore = new Chart(ctx, {
        type: 'doughnut',
        data: {
            datasets: [{
                data: [saglikSkoru, 100 - saglikSkoru],
                backgroundColor: [colorMap[durum], '#252a38'],
                borderWidth: 0,
            }]
        },
        options: {
            rotation: -90, circumference: 180, cutout: '78%', maintainAspectRatio: false,
            plugins: { legend: { display: false }, tooltip: { enabled: false } },
            animation: { duration: 700, easing: 'easeOutQuart' },
        }
    });
}

// ─── RATIO COMMENTARY ───────────────────────────────
const rasyoMeta = {
    cariOran: {
        ad: 'Current Ratio',
        kategori: 'likidite',
        formul: 'Current Assets / Current Liabilities',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 2) return { durum: 'ok', mesaj: 'Excellent liquidity. Can comfortably cover short-term liabilities.' };
            if (v >= 1.5) return { durum: 'ok', mesaj: 'Good liquidity. Short-term obligations are secure.' };
            if (v >= 1) return { durum: 'warn', mesaj: 'Adequate but tight. Watch cash flow closely.' };
            return { durum: 'danger', mesaj: 'CRITICAL: Current ratio below 1! High liquidity risk.' };
        }
    },
    asitTest: {
        ad: 'Acid-Test (Quick) Ratio',
        kategori: 'likidite',
        formul: '(Current Assets − Inventory) / Current Liabilities',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 1) return { durum: 'ok', mesaj: 'Sufficient liquidity even excluding inventory.' };
            if (v >= 0.8) return { durum: 'warn', mesaj: 'Caution: paying short-term debt without converting inventory to cash is difficult.' };
            return { durum: 'danger', mesaj: 'CRITICAL: Acid-test ratio very low, urgent liquidity risk.' };
        }
    },
    nakitOrani: {
        ad: 'Cash Ratio',
        kategori: 'likidite',
        formul: 'Cash / Current Liabilities',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 0.5) return { durum: 'ok', mesaj: 'Strong cash reserves.' };
            if (v >= 0.2) return { durum: 'warn', mesaj: 'Moderate cash reserves.' };
            return { durum: 'danger', mesaj: 'Insufficient cash reserves. Weak emergency payment capacity.' };
        }
    },
    borcOzkaynak: {
        ad: 'Debt / Equity',
        kategori: 'kaldirac',
        formul: 'Total Liabilities / Equity',
        yorum: (v) => {
            if (v === null) return null;
            if (v <= 0.5) return { durum: 'ok', mesaj: 'Low financial risk. Strong equity structure.' };
            if (v <= 1) return { durum: 'ok', mesaj: 'Acceptable level of borrowing.' };
            if (v <= 2) return { durum: 'warn', mesaj: 'Moderate leverage. Needs monitoring.' };
            return { durum: 'danger', mesaj: 'CRITICAL: High debt load! Financial fragility risk.' };
        }
    },
    finansalKaldirac: {
        ad: 'Financial Leverage Ratio',
        kategori: 'kaldirac',
        formul: 'Total Assets / Equity',
        yorum: (v) => {
            if (v === null) return null;
            if (v <= 1.5) return { durum: 'ok', mesaj: 'Low leverage, safe financing.' };
            if (v <= 2.5) return { durum: 'ok', mesaj: 'Reasonable leverage ratio.' };
            if (v <= 4) return { durum: 'warn', mesaj: 'High leverage, close monitoring advised.' };
            return { durum: 'danger', mesaj: 'CRITICAL: Very high leverage, elevated bankruptcy risk.' };
        }
    },
    borcAktif: {
        ad: 'Debt / Assets',
        kategori: 'kaldirac',
        formul: 'Total Liabilities / Total Assets',
        yorum: (v) => {
            if (v === null) return null;
            if (v <= 0.4) return { durum: 'ok', mesaj: 'The large majority of assets are financed by equity.' };
            if (v <= 0.6) return { durum: 'warn', mesaj: 'Debt ratio is high, keep monitoring.' };
            return { durum: 'danger', mesaj: 'CRITICAL: Most assets are debt-financed.' };
        }
    },
    faizKarsilama: {
        ad: 'Interest Coverage',
        kategori: 'kaldirac',
        formul: 'EBIT / Interest Expense',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 5) return { durum: 'ok', mesaj: 'Interest obligations are covered very comfortably.' };
            if (v >= 3) return { durum: 'ok', mesaj: 'Interest payments are secure.' };
            if (v >= 1.5) return { durum: 'warn', mesaj: 'Interest payments are covered but the margin is thin.' };
            return { durum: 'danger', mesaj: 'CRITICAL: Interest payments are at risk!' };
        }
    },
    brutKarMarji: {
        ad: 'Gross Profit Margin',
        kategori: 'karlilik',
        formul: 'Gross Profit / Net Sales',
        format: 'percent',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 0.5) return { durum: 'ok', mesaj: 'Very high gross margin.' };
            if (v >= 0.3) return { durum: 'ok', mesaj: 'Healthy gross margin.' };
            if (v >= 0.15) return { durum: 'warn', mesaj: 'Moderate margin, compare against industry norms.' };
            return { durum: 'danger', mesaj: 'Low gross margin. Cost pressure present.' };
        }
    },
    faaliyetKarMarji: {
        ad: 'Operating Margin',
        kategori: 'karlilik',
        formul: 'EBIT / Net Sales',
        format: 'percent',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 0.2) return { durum: 'ok', mesaj: 'Strong operational profitability.' };
            if (v >= 0.1) return { durum: 'ok', mesaj: 'Adequate operating profitability.' };
            if (v >= 0.05) return { durum: 'warn', mesaj: 'Weak operating margin.' };
            return { durum: 'danger', mesaj: 'Operating loss or very low profitability.' };
        }
    },
    netKarMarji: {
        ad: 'Net Profit Margin',
        kategori: 'karlilik',
        formul: 'Net Profit / Net Sales',
        format: 'percent',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 0.15) return { durum: 'ok', mesaj: 'Excellent net profitability.' };
            if (v >= 0.08) return { durum: 'ok', mesaj: 'Good net profit margin.' };
            if (v >= 0.03) return { durum: 'warn', mesaj: 'Low net profit margin.' };
            return { durum: 'danger', mesaj: 'Net loss or critically low margin.' };
        }
    },
    roe: {
        ad: 'ROE (Return on Equity)',
        kategori: 'karlilik',
        formul: 'Net Profit / Equity',
        format: 'percent',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 0.2) return { durum: 'ok', mesaj: 'Equity is being used very efficiently.' };
            if (v >= 0.1) return { durum: 'ok', mesaj: 'Adequate return on equity.' };
            if (v >= 0.05) return { durum: 'warn', mesaj: 'Low return on equity.' };
            return { durum: 'danger', mesaj: 'Insufficient return on equity.' };
        }
    },
    roa: {
        ad: 'ROA (Return on Assets)',
        kategori: 'karlilik',
        formul: 'Net Profit / Total Assets',
        format: 'percent',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 0.1) return { durum: 'ok', mesaj: 'Assets are being used very efficiently.' };
            if (v >= 0.05) return { durum: 'ok', mesaj: 'Good return on assets.' };
            if (v >= 0.02) return { durum: 'warn', mesaj: 'Low asset efficiency.' };
            return { durum: 'danger', mesaj: 'Assets are not being used profitably.' };
        }
    },
    aktifDevir: {
        ad: 'Asset Turnover',
        kategori: 'faaliyet',
        formul: 'Net Sales / Total Assets',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 2) return { durum: 'ok', mesaj: 'Assets convert to sales rapidly.' };
            if (v >= 1) return { durum: 'ok', mesaj: 'Adequate asset utilization.' };
            if (v >= 0.5) return { durum: 'warn', mesaj: 'Asset turnover is low.' };
            return { durum: 'danger', mesaj: 'Assets are not converting to sales.' };
        }
    },
    alacakDevir: {
        ad: 'Receivables Turnover',
        kategori: 'faaliyet',
        formul: 'Net Sales / Accounts Receivable',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 10) return { durum: 'ok', mesaj: 'Receivables are collected quickly.' };
            if (v >= 6) return { durum: 'ok', mesaj: 'Reasonable collection period.' };
            if (v >= 4) return { durum: 'warn', mesaj: 'Collections are slowing down.' };
            return { durum: 'danger', mesaj: 'Slow collections, cash-flow risk.' };
        }
    },
    stokDevir: {
        ad: 'Inventory Turnover',
        kategori: 'faaliyet',
        formul: 'Net Sales / Inventory',
        yorum: (v) => {
            if (v === null) return null;
            if (v >= 8) return { durum: 'ok', mesaj: 'Inventory converts to sales rapidly.' };
            if (v >= 4) return { durum: 'ok', mesaj: 'Efficient inventory management.' };
            if (v >= 2) return { durum: 'warn', mesaj: 'Inventory turnover is slowing.' };
            return { durum: 'danger', mesaj: 'Inventory is not selling, high storage cost.' };
        }
    },
    fd: {
        ad: 'P/E Ratio',
        kategori: 'piyasa',
        formul: 'Share Price / EPS',
        yorum: (v) => {
            if (v === null) return null;
            if (v <= 10) return { durum: 'ok', mesaj: 'Low P/E, shares look inexpensive.' };
            if (v <= 20) return { durum: 'ok', mesaj: 'Reasonable valuation.' };
            if (v <= 30) return { durum: 'warn', mesaj: 'Relatively high valuation.' };
            return { durum: 'danger', mesaj: 'Very high P/E, overvaluation risk.' };
        }
    },
};

// Thresholds behind each verdict, used to draw the benchmark bars.
// Marks mirror the yorum() cut-offs above — nothing is invented here.
const benchMap = {
    cariOran:         { max: 3,   marks: [1, 1.5] },
    asitTest:         { max: 2,   marks: [0.8, 1] },
    nakitOrani:       { max: 1,   marks: [0.2, 0.5] },
    borcOzkaynak:     { max: 3,   marks: [1, 2], inverse: true },
    finansalKaldirac: { max: 5,   marks: [2.5, 4], inverse: true },
    borcAktif:        { max: 1,   marks: [0.4, 0.6], inverse: true },
    faizKarsilama:    { max: 10,  marks: [1.5, 3] },
    brutKarMarji:     { max: 0.6, marks: [0.15, 0.3], format: 'percent' },
    faaliyetKarMarji: { max: 0.3, marks: [0.05, 0.1], format: 'percent' },
    netKarMarji:      { max: 0.3, marks: [0.03, 0.08], format: 'percent' },
    roe:              { max: 0.3, marks: [0.05, 0.1], format: 'percent' },
    roa:              { max: 0.15, marks: [0.02, 0.05], format: 'percent' },
    aktifDevir:       { max: 3,   marks: [0.5, 1] },
    alacakDevir:      { max: 12,  marks: [4, 6] },
    stokDevir:        { max: 10,  marks: [2, 4] },
    fd:               { max: 45,  marks: [20, 30], inverse: true },
};

// Dashboard KPI tiles: the six ratios the score is built from
const KPI_DEFS = [
    { key: 'cariOran', label: 'Current Ratio', format: null, bench: benchMap.cariOran },
    { key: 'asitTest', label: 'Acid-Test Ratio', format: null, bench: benchMap.asitTest },
    { key: 'borcOzkaynak', label: 'Debt / Equity', format: null, bench: benchMap.borcOzkaynak },
    { key: 'netKarMarji', label: 'Net Profit Margin', format: 'percent', bench: benchMap.netKarMarji },
    { key: 'aktifDevir', label: 'Asset Turnover', format: null, bench: benchMap.aktifDevir },
    { key: 'roe', label: 'ROE', format: 'percent', bench: benchMap.roe },
];

// ─── FORMAT ────────────────────────────────────────
function formatVal(v, meta) {
    if (v === null || isNaN(v)) return 'N/A';
    if (meta.format === 'percent') return (v * 100).toFixed(1) + '%';
    return v.toFixed(2);
}

// ─── BENCHMARK BARS ────────────────────────────────
// bench = { max, marks:[warn, ok], inverse?, format? }
// The bar shows where a value sits inside its healthy range — no invented
// history, only thresholds the commentary below already uses.
function benchHTML(bench, v) {
    if (!bench) return '';
    const pct = (v === null || v === undefined || isNaN(v))
        ? 0
        : Math.min(100, Math.max(0, (v / bench.max) * 100));
    const zones = (bench.marks || [])
        .map(m => Math.min(100, Math.max(0, (m / bench.max) * 100)))
        .map(p => `<i class="bench-zone" style="left:${p.toFixed(1)}%"></i>`)
        .join('');
    return `<div class="bench"><span class="bench-fill" style="width:${pct.toFixed(1)}%"></span>${zones}</div>`;
}

function benchLegend(bench) {
    if (!bench || !bench.marks || bench.marks.length < 2) return '';
    const fmt = x => (bench.format === 'percent' ? Math.round(x * 100) + '%' : String(x));
    return `<div class="bench-legend"><span>healthy ${bench.inverse ? '≤' : '≥'} ${fmt(bench.marks[1])}</span>` +
           `<span>scale ${bench.inverse ? '↑ worse' : '↑ better'} · max ${fmt(bench.max)}</span></div>`;
}

// ─── RENDER RATIOS ───────────────────────────────
function renderRatios() {
    document.getElementById('noDataMsg').classList.add('hidden');
    document.getElementById('ratioResults').classList.remove('hidden');

    const containers = {
        likidite: document.getElementById('rLikidite'),
        kaldirac: document.getElementById('rKaldirac'),
        karlilik: document.getElementById('rKarlilik'),
        faaliyet: document.getElementById('rFaaliyet'),
        piyasa: document.getElementById('rPiyasa'),
    };

    Object.values(containers).forEach(c => c.innerHTML = '');

    const catCounts = {};
    const statusCounts = { ok: 0, warn: 0, danger: 0 };

    Object.entries(rasyoMeta).forEach(([key, meta]) => {
        const v = rasyolar[key];
        if (v === undefined) return;
        const yorum = meta.yorum(v);
        if (!yorum) return;

        const badgeMap = { ok: 'badge-ok', warn: 'badge-warn', danger: 'badge-danger' };
        const labelMap = { ok: 'Good', warn: 'Caution', danger: 'Critical' };
        const fv = formatVal(v, meta);
        const bench = benchMap[key];
        const host = containers[meta.kategori];
        if (!host) return;

        const card = document.createElement('div');
        card.className = `ratio-card ${yorum.durum}`;
        card.innerHTML = `
            <div class="ratio-name">${meta.ad}</div>
            <div class="ratio-value">${fv}</div>
            ${benchHTML(bench, v)}
            ${benchLegend(bench)}
            <div class="ratio-comment">${yorum.mesaj}</div>
            <div class="ratio-formula">${meta.formul}</div>
            <span class="ratio-badge ${badgeMap[yorum.durum]}">${labelMap[yorum.durum]}</span>
        `;
        host.appendChild(card);
        catCounts[meta.kategori] = (catCounts[meta.kategori] || 0) + 1;
        statusCounts[yorum.durum]++;
    });

    const catIds = { likidite: 'cntLikidite', kaldirac: 'cntKaldirac', karlilik: 'cntKarlilik', faaliyet: 'cntFaaliyet', piyasa: 'cntPiyasa' };
    Object.entries(catIds).forEach(([cat, id]) => {
        const el = document.getElementById(id);
        if (el) {
            const n = catCounts[cat] || 0;
            el.textContent = `${n} ${n === 1 ? 'ratio' : 'ratios'}`;
        }
    });

    const summary = document.getElementById('ratioSummary');
    summary.hidden = false;
    summary.innerHTML = `
        <span class="sum-chip ok"><span class="dot"></span>${statusCounts.ok} good</span>
        <span class="sum-chip warn"><span class="dot"></span>${statusCounts.warn} caution</span>
        <span class="sum-chip danger"><span class="dot"></span>${statusCounts.danger} critical</span>
    `;
}

// ─── RENDER KPIs ───────────────────────────────────
function renderKPIs() {
    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = '';

    KPI_DEFS.forEach(def => {
        const v = rasyolar[def.key];
        const meta = rasyoMeta[def.key];
        const yorum = meta ? meta.yorum(v) : null;
        const hasValue = v !== null && v !== undefined && !isNaN(v);
        const status = yorum ? yorum.durum : 'empty';

        const card = document.createElement('div');
        card.className = `kpi-card ${status !== 'empty' ? 'status-' + status : 'kpi-empty'}`;
        card.innerHTML = `
            <div class="kpi-label">${def.label}<span class="kpi-status" aria-hidden="true"></span></div>
            <div class="kpi-value">${hasValue ? formatVal(v, { format: def.format }) : '—'}</div>
            ${benchHTML(def.bench, hasValue ? v : null)}
        `;
        grid.appendChild(card);
        if (hasValue) countUp(card.querySelector('.kpi-value'), v, x => formatVal(x, { format: def.format }));
    });

    // Critical feed: every ratio (not just the six KPI tiles) in trouble
    const alerts = [];
    Object.entries(rasyoMeta).forEach(([key, meta]) => {
        const yorum = meta.yorum(rasyolar[key]);
        if (yorum && yorum.durum === 'danger') alerts.push({ label: meta.ad, mesaj: yorum.mesaj });
    });

    const alertsBox = document.getElementById('alertsBox');
    const alertsList = document.getElementById('alertsList');
    const alertsCount = document.getElementById('alertsCount');
    alertsBox.classList.remove('hidden');
    alertsBox.classList.toggle('is-clear', alerts.length === 0);
    alertsCount.textContent = alerts.length ? `${alerts.length} open` : 'none open';
    alertsList.innerHTML = alerts.length
        ? alerts.map(a => `<div class="alert-item"><span class="alert-icon"><svg class="ico" aria-hidden="true"><use href="#i-alert"/></svg></span><div><strong>${a.label}:</strong> ${a.mesaj}</div></div>`).join('')
        : `<div class="alerts-clear"><svg class="ico" aria-hidden="true"><use href="#i-check"/></svg> No critical alerts — every ratio is inside an acceptable range.</div>`;
}

function updateKPIs() {
    document.getElementById('kpiGrid').innerHTML = KPI_DEFS.map(def => `
        <div class="kpi-card kpi-empty">
            <div class="kpi-label">${def.label}<span class="kpi-status" aria-hidden="true"></span></div>
            <div class="kpi-value">—</div>
            ${benchHTML(def.bench, null)}
        </div>`).join('');
    const alertsBox = document.getElementById('alertsBox');
    alertsBox.classList.add('is-clear');
    document.getElementById('alertsCount').textContent = 'awaiting data';
    document.getElementById('alertsList').innerHTML =
        `<p class="glossary-empty">Run an analysis to surface any ratio in the critical range.</p>`;
}

// ─── SCORE BREAKDOWN (dashboard) ───────────────────
function scoreComponents() {
    const debtSafety = 2 - (rasyolar.borcOzkaynak !== null && rasyolar.borcOzkaynak !== undefined ? rasyolar.borcOzkaynak : 2);
    return [
        { name: 'Current Ratio', norm: normalize(rasyolar.cariOran, 0, 3), raw: formatVal(rasyolar.cariOran, {}) },
        { name: 'Acid-Test', norm: normalize(rasyolar.asitTest, 0, 2), raw: formatVal(rasyolar.asitTest, {}) },
        { name: 'Net Profit Margin', norm: normalize(rasyolar.netKarMarji, 0, 0.3), raw: formatVal(rasyolar.netKarMarji, { format: 'percent' }) },
        { name: 'ROE', norm: normalize(rasyolar.roe, 0, 0.3), raw: formatVal(rasyolar.roe, { format: 'percent' }) },
        { name: 'Asset Turnover', norm: normalize(rasyolar.aktifDevir, 0, 3), raw: formatVal(rasyolar.aktifDevir, {}) },
        { name: 'Debt Safety', norm: normalize(debtSafety, 0, 2), raw: formatVal(rasyolar.borcOzkaynak, {}) },
    ];
}

function renderScoreBreakdown() {
    const list = document.getElementById('breakdownList');
    if (!analizYapildi) {
        list.innerHTML = scoreComponents().map(p =>
            `<div class="bd-row idle">
                <div class="bd-top"><span class="bd-name">${p.name}</span><span class="bd-val">—</span></div>
                <div class="bench"><span class="bench-fill" style="width:0%"></span></div>
            </div>`).join('');
        return;
    }
    const parts = scoreComponents();
    list.innerHTML = parts.map(p => {
        const pct = Math.round(Math.min(1, Math.max(0, p.norm)) * 100);
        const durum = pct >= 70 ? 'ok' : pct >= 40 ? 'warn' : 'danger';
        return `<div class="bd-row ${durum}">
            <div class="bd-top"><span class="bd-name">${p.name}</span><span class="bd-val">${pct}% · ${p.raw}</span></div>
            <div class="bench"><span class="bench-fill" style="width:${pct}%"></span></div>
        </div>`;
    }).join('');
}

// ─── BALANCE SHEET STRUCTURE (dashboard) ───────────
function structRow(label, total, segs) {
    const t = total > 0 ? total : 1;
    const bar = segs.map(s => {
        const p = (s.value / t) * 100;
        return `<span class="seg ${s.cls}" style="width:${p.toFixed(1)}%">${p >= 14 ? Math.round(p) + '%' : ''}</span>`;
    }).join('');
    const legend = segs.map(s =>
        `<span class="legend-item"><i class="legend-swatch ${s.cls}" aria-hidden="true"></i>${s.name} <b>${formatTL(s.value)}</b></span>`
    ).join('');
    return `<div class="struct-row">
        <div class="struct-label"><span>${label}</span><span class="struct-total">${formatTL(total)}</span></div>
        <div class="struct-bar" role="img" aria-label="${label}: ${segs.map(s => `${s.name} ${formatTL(s.value)}`).join(', ')}">${bar}</div>
        <div class="struct-legend">${legend}</div>
    </div>`;
}

function renderStructure() {
    const box = document.getElementById('structureBox');
    const meta = document.getElementById('structureMeta');

    if (!analizYapildi) {
        meta.textContent = 'Awaiting data';
        box.innerHTML = `<p class="glossary-empty">Run an analysis to see how the balance sheet is financed.</p>`;
        return;
    }

    const ta = g('toplamAktif');
    const dv = g('donenVarliklar');
    const ud = Math.max(0, ta - dv);
    const kvb = g('kisaVadeliBorclar');
    const uvb = g('uzunVadeliBorclar');
    const oz = g('ozkaynak');
    const fund = kvb + uvb + oz;

    meta.textContent = `Total assets ${formatTL(ta)}`;

    if (!ta && !fund) {
        box.innerHTML = `<p class="glossary-empty">No balance sheet figures entered yet.</p>`;
        return;
    }

    box.innerHTML =
        structRow('Assets', ta, [
            { name: 'Current assets', value: dv, cls: 'seg-a' },
            { name: 'Non-current assets', value: ud, cls: 'seg-b' },
        ]) +
        structRow('Funding', fund, [
            { name: 'Current liabilities', value: kvb, cls: 'seg-c' },
            { name: 'Long-term liabilities', value: uvb, cls: 'seg-d' },
            { name: 'Equity', value: oz, cls: 'seg-a' },
        ]);
}

// ─── CATEGORY VERDICTS (charts) ────────────────────
const CAT_META = [
    { key: 'likidite', ad: 'Liquidity' },
    { key: 'kaldirac', ad: 'Leverage' },
    { key: 'karlilik', ad: 'Profitability' },
    { key: 'faaliyet', ad: 'Activity' },
    { key: 'piyasa', ad: 'Market' },
];

function renderVerdicts() {
    const list = document.getElementById('verdictList');
    if (!list) return;
    const tag = document.querySelector('#verdictCard .chart-tag');
    if (tag) tag.textContent = `${Object.keys(rasyoMeta).length} ratios`;

    if (!analizYapildi) {
        list.innerHTML = CAT_META.map(c =>
            `<div class="verdict-row idle">
                <div class="v-top"><span class="v-name">${c.ad}</span><span class="v-count">—</span></div>
                <div class="v-bar"><span class="v-none" style="width:100%"></span></div>
            </div>`).join('');
        return;
    }

    list.innerHTML = CAT_META.map(c => {
        const counts = { ok: 0, warn: 0, danger: 0 };
        let total = 0;
        Object.entries(rasyoMeta).forEach(([key, meta]) => {
            if (meta.kategori !== c.key) return;
            const y = meta.yorum(rasyolar[key]);
            if (!y) return;
            counts[y.durum]++;
            total++;
        });
        if (!total) {
            return `<div class="verdict-row idle">
                <div class="v-top"><span class="v-name">${c.ad}</span><span class="v-count">no data</span></div>
                <div class="v-bar"><span class="v-none" style="width:100%"></span></div>
            </div>`;
        }
        const pct = n => (n / total * 100).toFixed(1);
        const worst = counts.danger ? 'danger' : counts.warn ? 'warn' : 'ok';
        const label = counts.danger
            ? `${counts.danger} critical / ${total}`
            : counts.warn
                ? `${counts.warn} caution / ${total}`
                : `${counts.ok} good / ${total}`;
        return `<div class="verdict-row">
            <div class="v-top"><span class="v-name">${c.ad}</span><span class="v-count ${worst}">${label}</span></div>
            <div class="v-bar">
                ${counts.ok ? `<span class="v-ok" style="width:${pct(counts.ok)}%"></span>` : ''}
                ${counts.warn ? `<span class="v-warn" style="width:${pct(counts.warn)}%"></span>` : ''}
                ${counts.danger ? `<span class="v-danger" style="width:${pct(counts.danger)}%"></span>` : ''}
            </div>
        </div>`;
    }).join('');
}

// ─── BALANCE CHECK (data entry) ────────────────────
function renderBalanceCheck() {
    const box = document.getElementById('balanceCheck');
    const text = document.getElementById('balanceCheckText');
    const ta = g('toplamAktif');
    const tb = g('toplamBorclar');
    const oz = g('ozkaynak');

    if (!ta || (!tb && !oz)) { box.hidden = true; return; }

    box.hidden = false;
    const diff = ta - (tb + oz);
    const tolerance = Math.abs(ta) * 0.01;

    if (Math.abs(diff) <= tolerance) {
        box.className = 'balance-check ok';
        text.textContent = `Balance sheet balances: assets ${formatTL(ta)} = liabilities ${formatTL(tb)} + equity ${formatTL(oz)}.`;
    } else {
        box.className = 'balance-check warn';
        text.textContent = `Out of balance by ${formatTL(Math.abs(diff))} — assets should equal liabilities + equity. Check the totals before analyzing.`;
    }
}

function bindBalanceCheck() {
    ['toplamAktif', 'toplamBorclar', 'ozkaynak'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', renderBalanceCheck);
    });
}
bindBalanceCheck();

function updateStatus(s) {
    const pill = document.getElementById('statusPill');
    const txt = document.getElementById('statusText');
    if (!s) { pill.className = 'status-pill'; txt.textContent = 'Awaiting Data'; return; }

    const alerts = Object.entries(rasyoMeta).filter(([k, m]) => {
        const v = rasyolar[k];
        const y = m.yorum(v);
        return y && y.durum === 'danger';
    });

    if (alerts.length >= 2) {
        pill.className = 'status-pill danger';
        txt.textContent = `${alerts.length} Critical Alerts`;
    } else if (alerts.length === 1) {
        pill.className = 'status-pill warn';
        txt.textContent = '1 Critical Alert';
    } else {
        pill.className = 'status-pill ok';
        txt.textContent = 'Analysis Complete';
    }
}

// ─── CHARTS ────────────────────────────────────────
const CHART_COLORS = {
    ok: TOKENS.accent,
    warn: TOKENS.warn,
    danger: TOKENS.danger,
    info: TOKENS.info,
    purple: '#a78bfa',
    neutral: TOKENS.text3,
    grid: TOKENS.grid,
    text: TOKENS.text2,
    track: TOKENS.track,
    bg: TOKENS.surface,
};

Chart.defaults.color = TOKENS.text2;
Chart.defaults.borderColor = TOKENS.grid;
Chart.defaults.font.family = "'DM Sans', system-ui, sans-serif";
Chart.defaults.font.size = 11;

// Centre caption for doughnut charts (registered once, opt-in per chart)
const centerTextPlugin = {
    id: 'centerText',
    afterDraw(chart, args, opts) {
        if (!opts || !opts.text) return;
        const { ctx, chartArea } = chart;
        if (!chartArea) return;
        const cx = (chartArea.left + chartArea.right) / 2;
        const cy = (chartArea.top + chartArea.bottom) / 2;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = TOKENS.text;
        ctx.font = "600 17px 'DM Sans', sans-serif";
        ctx.fillText(opts.text, cx, cy - 7);
        ctx.fillStyle = TOKENS.text3;
        ctx.font = "500 10.5px 'DM Sans', sans-serif";
        ctx.fillText(opts.sub || '', cx, cy + 12);
        ctx.restore();
    }
};
Chart.register(centerTextPlugin);

// Vertical gradient fill that follows the plotted area
function areaFill(color, top = 0.38, bottom = 0.02) {
    return (c) => {
        const { ctx, chartArea } = c.chart;
        if (!chartArea) return withAlpha(color, top);
        const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        grad.addColorStop(0, withAlpha(color, top));
        grad.addColorStop(1, withAlpha(color, bottom));
        return grad;
    };
}

const axisBase = {
    grid: { color: CHART_COLORS.grid, drawTicks: false },
    border: { display: false },
    ticks: { color: CHART_COLORS.text, padding: 6 },
};

function destroyChart(id) {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function renderCharts() {
    document.getElementById('noDataMsgChart').classList.add('hidden');
    document.getElementById('chartResults').classList.remove('hidden');

    // Liquidity: value per ratio vs its minimum threshold
    destroyChart('chartLikidite');
    const ctxL = document.getElementById('chartLikidite').getContext('2d');
    const likvars = [rasyolar.cariOran, rasyolar.asitTest, rasyolar.nakitOrani];
    const limitsL = [1.5, 1, 0.3];
    chartInstances.chartLikidite = new Chart(ctxL, {
        type: 'bar',
        data: {
            labels: ['Current Ratio', 'Acid-Test', 'Cash Ratio'],
            datasets: [
                {
                    label: 'Value',
                    data: likvars.map(v => v !== null ? parseFloat(v.toFixed(3)) : 0),
                    backgroundColor: likvars.map((v, i) => v !== null && v >= limitsL[i] ? withAlpha(CHART_COLORS.ok, 0.55) : withAlpha(CHART_COLORS.danger, 0.55)),
                    borderColor: likvars.map((v, i) => v !== null && v >= limitsL[i] ? CHART_COLORS.ok : CHART_COLORS.danger),
                    borderWidth: 1.5,
                    borderRadius: 5,
                    barPercentage: 0.6,
                },
                {
                    label: 'Min. threshold',
                    data: limitsL,
                    backgroundColor: withAlpha(CHART_COLORS.warn, 0.22),
                    borderColor: withAlpha(CHART_COLORS.warn, 0.75),
                    borderWidth: 1.5,
                    borderRadius: 5,
                    barPercentage: 0.6,
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { usePointStyle: true, boxWidth: 8, padding: 14 } },
                tooltip: { backgroundColor: CHART_COLORS.bg, borderColor: CHART_COLORS.grid, borderWidth: 1, padding: 10, cornerRadius: 8 },
            },
            scales: {
                x: { ...axisBase, grid: { display: false } },
                y: { ...axisBase, beginAtZero: true },
            }
        }
    });

    // Profitability in percent
    destroyChart('chartKarlilik');
    const ctxK = document.getElementById('chartKarlilik').getContext('2d');
    const kvals = [rasyolar.brutKarMarji, rasyolar.faaliyetKarMarji, rasyolar.netKarMarji, rasyolar.roe, rasyolar.roa];
    chartInstances.chartKarlilik = new Chart(ctxK, {
        type: 'bar',
        data: {
            labels: ['Gross Profit', 'Operating Profit', 'Net Profit', 'ROE', 'ROA'],
            datasets: [{
                label: '%',
                data: kvals.map(v => v !== null ? parseFloat((v * 100).toFixed(1)) : 0),
                backgroundColor: kvals.map(v => v !== null && v > 0.05 ? withAlpha(CHART_COLORS.ok, 0.5) : withAlpha(CHART_COLORS.danger, 0.5)),
                borderColor: kvals.map(v => v !== null && v > 0.05 ? CHART_COLORS.ok : CHART_COLORS.danger),
                borderWidth: 1.5,
                borderRadius: 5,
                barPercentage: 0.62,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: CHART_COLORS.bg, borderColor: CHART_COLORS.grid, borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: c => c.parsed.y + '%' } },
            },
            scales: {
                x: { ...axisBase, grid: { display: false } },
                y: { ...axisBase, beginAtZero: true, ticks: { ...axisBase.ticks, callback: v => v + '%' } },
            }
        }
    });

    // Asset composition
    destroyChart('chartVarlik');
    const ctxV = document.getElementById('chartVarlik').getContext('2d');
    const dv2 = g('donenVarliklar');
    const ta2 = g('toplamAktif');
    const dv_d = dv2 || 0;
    const ud_d = (ta2 - dv_d > 0) ? ta2 - dv_d : 0;
    chartInstances.chartVarlik = new Chart(ctxV, {
        type: 'doughnut',
        data: {
            labels: ['Current Assets', 'Non-Current Assets'],
            datasets: [{
                data: [dv_d, ud_d],
                backgroundColor: [withAlpha(CHART_COLORS.ok, 0.8), withAlpha(CHART_COLORS.info, 0.75)],
                borderColor: [CHART_COLORS.ok, CHART_COLORS.info],
                borderWidth: 2,
                hoverOffset: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14 } },
                tooltip: { backgroundColor: CHART_COLORS.bg, borderColor: CHART_COLORS.grid, borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: ctx => ctx.label + ': ' + formatTL(ctx.raw) } },
                centerText: { text: formatTL(ta2), sub: 'Total assets' },
            }
        }
    });

    // Liability structure
    destroyChart('chartBorc');
    const ctxB = document.getElementById('chartBorc').getContext('2d');
    const kvb2 = g('kisaVadeliBorclar');
    const uvb2 = g('uzunVadeliBorclar');
    const oz2 = g('ozkaynak');
    chartInstances.chartBorc = new Chart(ctxB, {
        type: 'doughnut',
        data: {
            labels: ['Current Liabilities', 'Long-Term Liabilities', 'Equity'],
            datasets: [{
                data: [kvb2 || 0, uvb2 || 0, oz2 || 0],
                backgroundColor: [withAlpha(CHART_COLORS.danger, 0.8), withAlpha(CHART_COLORS.warn, 0.8), withAlpha(CHART_COLORS.ok, 0.8)],
                borderColor: [CHART_COLORS.danger, CHART_COLORS.warn, CHART_COLORS.ok],
                borderWidth: 2,
                hoverOffset: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom', labels: { usePointStyle: true, boxWidth: 8, padding: 14 } },
                tooltip: { backgroundColor: CHART_COLORS.bg, borderColor: CHART_COLORS.grid, borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: ctx => ctx.label + ': ' + formatTL(ctx.raw) } },
                centerText: { text: formatTL(kvb2 + uvb2 + oz2), sub: 'Liabilities + equity' },
            }
        }
    });

    // Radar — the six score components, 0-100
    destroyChart('chartRadar');
    const ctxR = document.getElementById('chartRadar').getContext('2d');
    const radarVals = scoreComponents().map(p => Math.round(Math.min(1, Math.max(0, p.norm)) * 100));

    chartInstances.chartRadar = new Chart(ctxR, {
        type: 'radar',
        data: {
            labels: ['Current Ratio', 'Acid-Test', 'Net Profit Margin', 'ROE', 'Asset Turnover', 'Debt Safety'],
            datasets: [{
                label: 'Company',
                data: radarVals,
                backgroundColor: withAlpha(CHART_COLORS.ok, 0.16),
                borderColor: CHART_COLORS.ok,
                pointBackgroundColor: CHART_COLORS.ok,
                pointBorderColor: TOKENS.bg,
                pointRadius: 4,
                pointHoverRadius: 6,
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    min: 0, max: 100,
                    ticks: { display: false, stepSize: 25 },
                    grid: { color: CHART_COLORS.grid },
                    angleLines: { color: CHART_COLORS.grid },
                    pointLabels: { color: CHART_COLORS.text, font: { size: 11.5, weight: '500' } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: { backgroundColor: CHART_COLORS.bg, borderColor: CHART_COLORS.grid, borderWidth: 1, padding: 10, cornerRadius: 8, callbacks: { label: c => c.parsed.r + ' / 100' } },
            }
        }
    });

    if (window.FcViz) {
        FcViz.dupont(document.getElementById('vizDupont'), rasyolar);
        FcViz.bands(document.getElementById('vizBands'), rasyolar);
    }
}

function formatTL(v) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

// ─── REPORT ────────────────────────────────────────
function renderReport() {
    document.getElementById('noDataMsgReport').classList.add('hidden');
    document.getElementById('reportContent').classList.remove('hidden');

    const body = document.getElementById('reportBody');

    const rows = Object.entries(rasyoMeta).map(([key, meta]) => {
        const v = rasyolar[key];
        if (v === undefined || v === null) return '';
        const fv = formatVal(v, meta);
        const yorum = meta.yorum(v);
        if (!yorum) return '';
        const cls = yorum.durum;
        return `<tr>
            <td>${meta.ad}</td>
            <td class="${cls}">${fv}</td>
            <td>${meta.formul}</td>
            <td class="${cls}">${yorum.mesaj}</td>
        </tr>`;
    }).join('');

    const date = new Date().toLocaleDateString('en-US');
    const skor = saglikSkoru === null ? null : saglikSkoru;
    const { durum, etiket } = saglikDurumu(skor === null ? 0 : skor);

    body.innerHTML = `
        <div class="report-hero">
            <div class="report-hero-left">
                <h3>Financial Analysis Report</h3>
                <p>Generated ${date} &nbsp;·&nbsp; Financial Compass</p>
            </div>
            <div class="report-score">
                <div>
                    <div class="report-score-num ${skor === null ? '' : durum}">${skor === null ? '—' : skor}</div>
                    <div class="report-score-label">Health score / 100</div>
                </div>
                ${skor === null ? '' : `<span class="report-score-chip ${durum}">${etiket}</span>`}
            </div>
        </div>
        <div class="report-section">
            <h3>All Ratio Results</h3>
            <table class="report-table">
                <thead><tr><th>Ratio</th><th>Value</th><th>Formula</th><th>Comment</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
        <div class="report-section">
            <h3>Financial Summary</h3>
            <table class="report-table">
                <thead><tr><th>Item</th><th>Value</th></tr></thead>
                <tbody>
                    ${[
                        ['Total Assets', formatTL(g('toplamAktif'))],
                        ['Net Sales', formatTL(g('netSatislar'))],
                        ['Net Profit', formatTL(g('netKar'))],
                        ['Total Liabilities', formatTL(g('toplamBorclar'))],
                        ['Equity', formatTL(g('ozkaynak'))],
                    ].map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function raporuYazdir() {
    window.print();
}

function raporuCSVIndir() {
    const rows = [['Ratio', 'Value', 'Status', 'Comment']];
    Object.entries(rasyoMeta).forEach(([key, meta]) => {
        const v = rasyolar[key];
        if (v === null || v === undefined) return;
        const yorum = meta.yorum(v);
        if (!yorum) return;
        rows.push([meta.ad, formatVal(v, meta), yorum.durum, yorum.mesaj]);
    });
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'financial_analysis.csv'; a.click();
    showToast('CSV downloaded ✓', 'success');
}

function sablonIndir() {
    const alanlar = ['donenVarliklar','stoklar','nakit','toplamAktif','kisaVadeliBorclar',
        'uzunVadeliBorclar','toplamBorclar','ozkaynak','netSatislar','brutKar',
        'faaliyetKari','netKar','alacaklar','faizGiderleri','eps','hisseFiyati'];
    const csv = 'field,value\n' + alanlar.map(a => `${a},0`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'financial_compass_template.csv'; a.click();
    showToast('Template downloaded ✓', 'success');
}

// ─── GLOSSARY ────────────────────────────────────────
const sozluk = [
    { terim: 'Current Ratio', kat: 'Liquidity', aciklama: 'Current assets divided by current liabilities. Shows the company\'s capacity to cover short-term obligations. Generally accepted as healthy between 1.5–2.' },
    { terim: 'Acid-Test Ratio (Quick Ratio)', kat: 'Liquidity', aciklama: 'Current assets minus inventory, divided by current liabilities. Measures liquidity in the scenario where inventory cannot be sold.' },
    { terim: 'Cash Ratio', kat: 'Liquidity', aciklama: 'Only cash and cash equivalents divided by current liabilities. The strictest liquidity indicator.' },
    { terim: 'Debt / Equity (Leverage)', kat: 'Leverage', aciklama: 'Total liabilities divided by equity. Shows how much external financing the company uses. Below 1 is generally considered safe.' },
    { terim: 'Financial Leverage Ratio', kat: 'Leverage', aciklama: 'Total assets divided by equity. Shows what fraction of assets is financed with debt.' },
    { terim: 'Interest Coverage Ratio', kat: 'Leverage', aciklama: 'EBIT divided by interest expense. Shows how comfortably the company covers its interest payments. 3 or above is considered healthy.' },
    { terim: 'Gross Profit Margin', kat: 'Profitability', aciklama: 'Gross profit divided by net sales. Shows the profit margin remaining after production/purchase costs.' },
    { terim: 'Net Profit Margin', kat: 'Profitability', aciklama: 'Net profit divided by net sales. Measures final profitability after all expenses are covered.' },
    { terim: 'ROE (Return on Equity)', kat: 'Profitability', aciklama: 'Net profit divided by equity. Shows how efficiently shareholders\' invested capital is being used.' },
    { terim: 'ROA (Return on Assets)', kat: 'Profitability', aciklama: 'Net profit divided by total assets. Shows how efficiently the company uses all of its assets.' },
    { terim: 'EBIT', kat: 'Profitability', aciklama: 'Earnings Before Interest and Taxes. Shows the company\'s operating profitability.' },
    { terim: 'Asset Turnover', kat: 'Activity', aciklama: 'Net sales divided by total assets. Measures how quickly assets convert into sales. Higher is preferred.' },
    { terim: 'Receivables Turnover', kat: 'Activity', aciklama: 'Net sales divided by accounts receivable. Shows how quickly receivables are collected.' },
    { terim: 'Inventory Turnover', kat: 'Activity', aciklama: 'Net sales divided by inventory. Measures how quickly inventory converts into sales.' },
    { terim: 'P/E Ratio (Price/Earnings)', kat: 'Market', aciklama: 'Share price divided by earnings per share. Shows how many years of earnings the market is valuing the company at.' },
    { terim: 'EPS (Earnings Per Share)', kat: 'Market', aciklama: 'Net profit divided by total number of shares. Shows the profit attributable to each share.' },
    { terim: 'Equity', kat: 'Basics', aciklama: 'Total assets minus total liabilities. The company\'s net worth attributable to shareholders.' },
    { terim: 'Liquidity', kat: 'Basics', aciklama: 'An asset\'s ability to be quickly converted to cash. High liquidity indicates strong debt-repayment capacity.' },
];

let glossaryKat = 'All';

function glossaryCats() {
    return ['All', ...new Set(sozluk.map(s => s.kat))];
}

function renderGlossaryChips() {
    const host = document.getElementById('glossaryChips');
    host.innerHTML = glossaryCats().map(kat => {
        const n = kat === 'All' ? sozluk.length : sozluk.filter(s => s.kat === kat).length;
        return `<button type="button" class="g-chip ${glossaryKat === kat ? 'active' : ''}" onclick="setGlossaryKat('${kat}')">${kat} · ${n}</button>`;
    }).join('');
}

function setGlossaryKat(kat) {
    glossaryKat = kat;
    renderGlossaryChips();
    renderGlossary(document.getElementById('glossarySearch').value);
}

function renderGlossary(filter = '') {
    const list = document.getElementById('glossaryList');
    const f = filter.trim().toLowerCase();
    const filtered = sozluk.filter(s =>
        (glossaryKat === 'All' || s.kat === glossaryKat) &&
        (s.terim.toLowerCase().includes(f) || s.aciklama.toLowerCase().includes(f))
    );

    document.getElementById('glossaryCount').textContent = `${filtered.length} of ${sozluk.length} terms`;

    list.innerHTML = filtered.length
        ? filtered.map((s, i) => `
            <div class="glossary-item" id="gi-${i}">
                <h4 onclick="toggleGlossary(${i})">${s.terim}<span class="g-term-tag">${s.kat}</span><span class="g-toggle">+</span></h4>
                <p>${s.aciklama}</p>
            </div>
        `).join('')
        : `<p class="glossary-empty">No terms match “${filter}”. Try another word or switch category.</p>`;
}

function toggleGlossary(i) {
    const el = document.getElementById('gi-' + i);
    if (!el) return;
    el.classList.toggle('open');
    el.querySelector('.g-toggle').textContent = el.classList.contains('open') ? '−' : '+';
}

function filterGlossary() {
    renderGlossary(document.getElementById('glossarySearch').value);
}

// ─── TOAST ────────────────────────────────────────
function showToast(msg, type = '') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ─── INIT ──────────────────────────────────────────
const chipRatioCount = document.getElementById('chipRatioCount');
if (chipRatioCount) chipRatioCount.textContent = `${Object.keys(rasyoMeta).length} ratios`;
renderGlossaryChips();
renderGlossary();
updateKPIs();
renderScoreBreakdown();
renderStructure();
renderVerdicts();
renderHealthScore();
