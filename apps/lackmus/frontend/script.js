/* =============================================
   FINANCIAL COMPASS — script.js
   Internal identifiers (field ids, object keys like
   "cariOran"/"donenVarliklar") are left as-is on purpose -
   they're plumbing, not user-facing text, and renaming them
   would touch every line of this file for zero visible benefit.
   Only the DISPLAYED strings are translated to English.
   ============================================= */

// ─── STATE ────────────────────────────────────────
let veri = {};
let rasyolar = {};
let chartInstances = {};
let analizYapildi = false;
let saglikSkoru = null;

// ─── NAV ──────────────────────────────────────────
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

    // Close sidebar on mobile
    if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
    }
}

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', e => {
        e.preventDefault();
        showSection(item.dataset.section);
    });
});

document.getElementById('menuToggle').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
});

// ─── TABS ──────────────────────────────────────────
document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
        const parent = tab.closest('.tabs');
        parent.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
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
    document.getElementById('alertsBox').classList.add('hidden');
    updateKPIs(null);
    updateStatus(null);
    renderHealthScore();
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
    renderCharts();
    renderHealthScore();
    renderReport();
    updateStatus();
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

    numberEl.textContent = saglikSkoru;
    numberEl.style.color = colorMap[durum];
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

// ─── FORMAT ────────────────────────────────────────
function formatVal(v, meta) {
    if (v === null || isNaN(v)) return 'N/A';
    if (meta.format === 'percent') return (v * 100).toFixed(1) + '%';
    return v.toFixed(2);
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

    Object.entries(rasyoMeta).forEach(([key, meta]) => {
        const v = rasyolar[key];
        if (v === undefined) return;
        const yorum = meta.yorum(v);
        if (!yorum) return;

        const badgeMap = { ok: 'badge-ok', warn: 'badge-warn', danger: 'badge-danger' };
        const labelMap = { ok: 'Good', warn: 'Caution', danger: 'Critical' };
        const fv = formatVal(v, meta);

        const card = document.createElement('div');
        card.className = `ratio-card ${yorum.durum}`;
        card.innerHTML = `
            <div class="ratio-name">${meta.ad}</div>
            <div class="ratio-value">${fv}</div>
            <div class="ratio-formula">${meta.formul}</div>
            <div class="ratio-comment">${yorum.mesaj}</div>
            <span class="ratio-badge ${badgeMap[yorum.durum]}">${labelMap[yorum.durum]}</span>
        `;
        containers[meta.kategori]?.appendChild(card);
    });
}

// ─── RENDER KPIs ───────────────────────────────────
function renderKPIs() {
    const kpiDef = [
        { key: 'cariOran', icon: '💧', label: 'Current Ratio', format: null },
        { key: 'asitTest', icon: '⚗️', label: 'Acid-Test Ratio', format: null },
        { key: 'borcOzkaynak', icon: '⚖️', label: 'Debt / Equity', format: null },
        { key: 'netKarMarji', icon: '📈', label: 'Net Profit Margin', format: 'percent' },
        { key: 'aktifDevir', icon: '🔄', label: 'Asset Turnover', format: null },
        { key: 'roe', icon: '💰', label: 'ROE', format: 'percent' },
    ];

    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = '';

    const alerts = [];

    kpiDef.forEach(def => {
        const v = rasyolar[def.key];
        const meta = rasyoMeta[def.key];
        const yorum = meta ? meta.yorum(v) : null;
        const fv = v !== null && v !== undefined ? formatVal(v, { format: def.format }) : '—';
        const status = yorum ? yorum.durum : 'empty';

        const card = document.createElement('div');
        card.className = `kpi-card ${status !== 'empty' ? 'status-' + status : 'kpi-empty'}`;
        card.innerHTML = `
            <div class="kpi-icon">${def.icon}</div>
            <div class="kpi-label">${def.label}</div>
            <div class="kpi-value">${fv}</div>
        `;
        grid.appendChild(card);

        if (yorum && yorum.durum === 'danger') {
            alerts.push({ label: def.label, mesaj: yorum.mesaj });
        }
    });

    const alertsBox = document.getElementById('alertsBox');
    const alertsList = document.getElementById('alertsList');

    if (alerts.length > 0) {
        alertsBox.classList.remove('hidden');
        alertsList.innerHTML = alerts.map(a =>
            `<div class="alert-item"><span class="alert-icon">🔴</span><div><strong>${a.label}:</strong> ${a.mesaj}</div></div>`
        ).join('');
    } else {
        alertsBox.classList.add('hidden');
    }
}

function updateKPIs(data) {
    const grid = document.getElementById('kpiGrid');
    grid.innerHTML = `
        <div class="kpi-card kpi-empty"><div class="kpi-icon">💧</div><div class="kpi-label">Current Ratio</div><div class="kpi-value">—</div></div>
        <div class="kpi-card kpi-empty"><div class="kpi-icon">⚗️</div><div class="kpi-label">Acid-Test Ratio</div><div class="kpi-value">—</div></div>
        <div class="kpi-card kpi-empty"><div class="kpi-icon">⚖️</div><div class="kpi-label">Debt / Equity</div><div class="kpi-value">—</div></div>
        <div class="kpi-card kpi-empty"><div class="kpi-icon">📈</div><div class="kpi-label">Net Profit Margin</div><div class="kpi-value">—</div></div>
        <div class="kpi-card kpi-empty"><div class="kpi-icon">🔄</div><div class="kpi-label">Asset Turnover</div><div class="kpi-value">—</div></div>
        <div class="kpi-card kpi-empty"><div class="kpi-icon">💰</div><div class="kpi-label">ROE</div><div class="kpi-value">—</div></div>
    `;
}

function updateStatus(s) {
    const dot = document.getElementById('statusDot');
    const txt = document.getElementById('statusText');
    if (!s) { dot.className = 'status-dot'; txt.textContent = 'Awaiting Data'; return; }

    const alerts = Object.entries(rasyoMeta).filter(([k, m]) => {
        const v = rasyolar[k];
        const y = m.yorum(v);
        return y && y.durum === 'danger';
    });

    if (alerts.length >= 2) {
        dot.className = 'status-dot danger';
        txt.textContent = `${alerts.length} Critical Alerts`;
    } else if (alerts.length === 1) {
        dot.className = 'status-dot warn';
        txt.textContent = '1 Critical Alert';
    } else {
        dot.className = 'status-dot ok';
        txt.textContent = 'Analysis Complete';
    }
}

// ─── CHARTS ────────────────────────────────────────
const CHART_COLORS = {
    ok: '#4ade80',
    warn: '#f59e0b',
    danger: '#ef4444',
    neutral: '#6b7280',
    bg: '#1e2332',
};

Chart.defaults.color = '#9ba3b8';
Chart.defaults.borderColor = '#2e3347';
Chart.defaults.font.family = 'DM Sans';

function destroyChart(id) {
    if (chartInstances[id]) { chartInstances[id].destroy(); delete chartInstances[id]; }
}

function renderCharts() {
    document.getElementById('noDataMsgChart').classList.add('hidden');
    document.getElementById('chartResults').classList.remove('hidden');

    // Liquidity bar chart
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
                    backgroundColor: likvars.map((v, i) => v !== null && v >= limitsL[i] ? '#4ade8066' : '#ef444466'),
                    borderColor: likvars.map((v, i) => v !== null && v >= limitsL[i] ? '#4ade80' : '#ef4444'),
                    borderWidth: 2,
                    borderRadius: 6,
                },
                {
                    label: 'Min. Threshold',
                    data: limitsL,
                    type: 'line',
                    borderColor: '#f59e0b',
                    borderDash: [5, 5],
                    pointRadius: 0,
                    borderWidth: 2,
                    fill: false,
                }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: true } },
            scales: { y: { beginAtZero: true } }
        }
    });

    // Profitability bar chart (percentages)
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
                backgroundColor: kvals.map(v => v !== null && v > 0.05 ? '#4ade8055' : '#ef444455'),
                borderColor: kvals.map(v => v !== null && v > 0.05 ? '#4ade80' : '#ef4444'),
                borderWidth: 2,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true, ticks: { callback: v => v + '%' } } }
        }
    });

    // Asset composition doughnut
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
                backgroundColor: ['#4ade8066', '#3b82f666'],
                borderColor: ['#4ade80', '#3b82f6'],
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: ctx => ctx.label + ': ' + formatTL(ctx.raw) } }
            }
        }
    });

    // Liability structure doughnut
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
                backgroundColor: ['#ef444466', '#f59e0b66', '#4ade8066'],
                borderColor: ['#ef4444', '#f59e0b', '#4ade80'],
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom' },
                tooltip: { callbacks: { label: ctx => ctx.label + ': ' + formatTL(ctx.raw) } }
            }
        }
    });

    // Radar
    destroyChart('chartRadar');
    const ctxR = document.getElementById('chartRadar').getContext('2d');

    const radarVals = [
        normalize(rasyolar.cariOran, 0, 3) * 100,
        normalize(rasyolar.asitTest, 0, 2) * 100,
        normalize(rasyolar.netKarMarji, 0, 0.3) * 100,
        normalize(rasyolar.roe, 0, 0.3) * 100,
        normalize(rasyolar.aktifDevir, 0, 3) * 100,
        normalize(2 - (rasyolar.borcOzkaynak || 2), 0, 2) * 100,
    ];

    chartInstances.chartRadar = new Chart(ctxR, {
        type: 'radar',
        data: {
            labels: ['Current Ratio', 'Acid-Test', 'Net Profit Margin', 'ROE', 'Asset Turnover', 'Debt Safety'],
            datasets: [{
                label: 'Company',
                data: radarVals,
                backgroundColor: 'rgba(74,222,128,0.15)',
                borderColor: '#4ade80',
                pointBackgroundColor: '#4ade80',
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            scales: {
                r: {
                    min: 0, max: 100,
                    ticks: { display: false },
                    grid: { color: '#2e3347' },
                    pointLabels: { color: '#9ba3b8', font: { size: 12 } }
                }
            },
            plugins: { legend: { display: false } }
        }
    });
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

    body.innerHTML = `
        <div class="report-section">
            <h3>Financial Analysis Report</h3>
            <p style="color:var(--text2);font-size:13px;">Date: ${date} &nbsp;|&nbsp; Analysis: Financial Compass</p>
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
    { terim: 'Current Ratio', aciklama: 'Current assets divided by current liabilities. Shows the company\'s capacity to cover short-term obligations. Generally accepted as healthy between 1.5–2.' },
    { terim: 'Acid-Test Ratio (Quick Ratio)', aciklama: 'Current assets minus inventory, divided by current liabilities. Measures liquidity in the scenario where inventory cannot be sold.' },
    { terim: 'Cash Ratio', aciklama: 'Only cash and cash equivalents divided by current liabilities. The strictest liquidity indicator.' },
    { terim: 'Debt / Equity (Leverage)', aciklama: 'Total liabilities divided by equity. Shows how much external financing the company uses. Below 1 is generally considered safe.' },
    { terim: 'Financial Leverage Ratio', aciklama: 'Total assets divided by equity. Shows what fraction of assets is financed with debt.' },
    { terim: 'Interest Coverage Ratio', aciklama: 'EBIT divided by interest expense. Shows how comfortably the company covers its interest payments. 3 or above is considered healthy.' },
    { terim: 'Gross Profit Margin', aciklama: 'Gross profit divided by net sales. Shows the profit margin remaining after production/purchase costs.' },
    { terim: 'Net Profit Margin', aciklama: 'Net profit divided by net sales. Measures final profitability after all expenses are covered.' },
    { terim: 'ROE (Return on Equity)', aciklama: 'Net profit divided by equity. Shows how efficiently shareholders\' invested capital is being used.' },
    { terim: 'ROA (Return on Assets)', aciklama: 'Net profit divided by total assets. Shows how efficiently the company uses all of its assets.' },
    { terim: 'Asset Turnover', aciklama: 'Net sales divided by total assets. Measures how quickly assets convert into sales. Higher is preferred.' },
    { terim: 'Receivables Turnover', aciklama: 'Net sales divided by accounts receivable. Shows how quickly receivables are collected.' },
    { terim: 'Inventory Turnover', aciklama: 'Net sales divided by inventory. Measures how quickly inventory converts into sales.' },
    { terim: 'P/E Ratio (Price/Earnings)', aciklama: 'Share price divided by earnings per share. Shows how many years of earnings the market is valuing the company at.' },
    { terim: 'EPS (Earnings Per Share)', aciklama: 'Net profit divided by total number of shares. Shows the profit attributable to each share.' },
    { terim: 'EBIT', aciklama: 'Earnings Before Interest and Taxes. Shows the company\'s operating profitability.' },
    { terim: 'Equity', aciklama: 'Total assets minus total liabilities. The company\'s net worth attributable to shareholders.' },
    { terim: 'Liquidity', aciklama: 'An asset\'s ability to be quickly converted to cash. High liquidity indicates strong debt-repayment capacity.' },
];

function renderGlossary(filter = '') {
    const list = document.getElementById('glossaryList');
    const filtered = sozluk.filter(s =>
        s.terim.toLowerCase().includes(filter.toLowerCase()) ||
        s.aciklama.toLowerCase().includes(filter.toLowerCase())
    );
    list.innerHTML = filtered.map((s, i) => `
        <div class="glossary-item" id="gi-${i}">
            <h4 onclick="toggleGlossary(${i})">${s.terim} <span>+</span></h4>
            <p>${s.aciklama}</p>
        </div>
    `).join('');
}

function toggleGlossary(i) {
    const el = document.getElementById('gi-' + i);
    el.classList.toggle('open');
    el.querySelector('span').textContent = el.classList.contains('open') ? '−' : '+';
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
renderGlossary();
renderHealthScore();
