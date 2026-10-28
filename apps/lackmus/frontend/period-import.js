// Multi-period import for Financial Compass: turns CSV, TSV, TXT, JSON, JSONL,
// XML, YAML and spreadsheet files (XLSX/XLS/ODS) into period snapshots.
// Two layouts are recognised, whatever the container format:
//   wide: first column = field names, the other columns = periods
//   long: one row/object per period, columns/keys = fields
// Field names are matched loosely (English, Turkish, canonical ids).
window.FcImport = (function () {
    const MAX_BYTES = 5 * 1024 * 1024;
    const FIELDS = ['donenVarliklar', 'stoklar', 'nakit', 'toplamAktif', 'kisaVadeliBorclar',
        'uzunVadeliBorclar', 'toplamBorclar', 'ozkaynak', 'netSatislar', 'brutKar',
        'faaliyetKari', 'netKar', 'alacaklar', 'faizGiderleri', 'eps', 'hisseFiyati'];

    const norm = s => String(s == null ? '' : s).trim()
        .replace(/İ/g, 'i').toLowerCase()
        .replace(/ı/g, 'i').replace(/ş/g, 's').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ö/g, 'o').replace(/ç/g, 'c').replace(/â/g, 'a')
        .replace(/[^a-z0-9]/g, '');

    const ALIASES = {
        donenVarliklar: ['currentassets', 'totalcurrentassets', 'donenvarliklar'],
        stoklar: ['inventory', 'inventories', 'stok', 'stoklar'],
        nakit: ['cash', 'cashequivalents', 'cashandequivalents', 'cashandcashequivalents', 'nakit'],
        toplamAktif: ['totalassets', 'assets', 'toplamaktif', 'toplamvarliklar', 'aktiftoplami'],
        kisaVadeliBorclar: ['currentliabilities', 'totalcurrentliabilities', 'shorttermdebt', 'shorttermliabilities', 'kisavadeliborclar', 'kisavadeliyabancikaynaklar'],
        uzunVadeliBorclar: ['longtermliabilities', 'longtermdebt', 'noncurrentliabilities', 'uzunvadeliborclar', 'uzunvadeliyabancikaynaklar'],
        toplamBorclar: ['totalliabilities', 'totaldebt', 'liabilities', 'toplamborclar', 'toplamyabancikaynaklar'],
        ozkaynak: ['equity', 'totalequity', 'shareholdersequity', 'stockholdersequity', 'ozkaynak', 'ozkaynaklar', 'ozsermaye'],
        netSatislar: ['netsales', 'sales', 'revenue', 'revenues', 'netrevenue', 'totalrevenue', 'netsatislar', 'satislar', 'hasilat'],
        brutKar: ['grossprofit', 'grossincome', 'brutkar', 'brutsatiskari'],
        faaliyetKari: ['operatingincome', 'operatingprofit', 'ebit', 'faaliyetkari', 'esasfaaliyetkari'],
        netKar: ['netincome', 'netprofit', 'netearnings', 'profitaftertax', 'netkar', 'donemnetkari', 'donemkari'],
        alacaklar: ['receivables', 'accountsreceivable', 'tradereceivables', 'alacaklar', 'ticarialacaklar'],
        faizGiderleri: ['interestexpense', 'interestexpenses', 'financecosts', 'financeexpenses', 'faizgiderleri', 'finansmangiderleri', 'finansmangideri'],
        eps: ['eps', 'earningspershare', 'hissebasinakar'],
        hisseFiyati: ['shareprice', 'stockprice', 'price', 'marketprice', 'hissefiyati'],
    };
    const ALIAS = new Map();
    FIELDS.forEach(f => ALIAS.set(norm(f), f));
    Object.entries(ALIASES).forEach(([f, list]) => list.forEach(a => ALIAS.set(a, f)));
    const fieldOf = k => ALIAS.get(norm(k)) || null;

    const PERIOD_KEYS = new Set(['period', 'periods', 'year', 'label', 'date', 'fy', 'fiscalyear', 'donem', 'yil', 'name', 'quarter', 'time']);

    // "1.234,56", "1,234.56", "(500)", "$ 2,100,000", "3.4" -> number, else null
    function toNumber(x, eu) {
        if (typeof x === 'number') return isFinite(x) ? x : null;
        if (x == null) return null;
        let s = String(x).trim();
        if (!s) return null;
        let neg = false;
        if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
        s = s.replace(/[\s ]/g, '').replace(/[$€£₺]|TL|TRY|USD|EUR/gi, '');
        if (/^-/.test(s)) { neg = !neg; s = s.slice(1); } else if (/^\+/.test(s)) s = s.slice(1);
        if (!/^[\d.,]+$/.test(s)) return null;
        if (eu) s = s.replace(/\./g, '').replace(',', '.');
        const hasC = !eu && s.includes(','), hasD = !eu && s.includes('.');
        if (eu) {
            // already normalised above
        } else if (hasC && hasD) {
            s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
        } else if (hasC) {
            s = /^\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
        } else if (hasD && /^\d{1,3}(\.\d{3}){2,}$/.test(s)) {
            s = s.replace(/\./g, '');
        }
        const n = parseFloat(s);
        return isNaN(n) ? null : (neg ? -n : n);
    }

    // A file written with dot-thousands / comma-decimals ("3.000.000,50") is read that way
    // as a whole; mixed or comma-thousands files keep the default reading.
    function detectEu(m) {
        let eu = false;
        for (const r of m) for (const c of r) {
            if (typeof c !== 'string') continue;
            const t = c.trim();
            if (/^\(?-?\d{1,3}(,\d{3})+(\.\d+)?\)?$/.test(t)) return false;
            if (/^\(?-?\d{1,3}(\.\d{3})+(,\d+)?\)?$/.test(t) || /^\(?-?\d+,\d{1,2}\)?$/.test(t)) eu = true;
        }
        return eu;
    }

    const isEmpty = v => v === '' || v === null || v === undefined;
    const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);

    // ─── layout detection on a matrix of cells ────────────────
    function fromMatrix(m, fallbackLabel) {
        m = m.map(r => (Array.isArray(r) ? r : [r])).filter(r => r.some(c => !isEmpty(c)));
        if (m.length < 2) throw new Error('Not enough rows');
        const header = m[0], body = m.slice(1);
        const eu = detectEu(body);
        const headerHits = header.filter(h => fieldOf(h)).length;
        const firstColHits = body.filter(r => fieldOf(r[0])).length;

        if (headerHits >= 3 && headerHits >= firstColHits) {
            const fieldCols = header.map(h => fieldOf(h));
            let labelCol = header.findIndex((h, i) => !fieldCols[i] && PERIOD_KEYS.has(norm(h)));
            if (labelCol < 0) labelCol = header.findIndex((h, i) => !fieldCols[i]);
            const unrecognized = header.filter((h, i) => !fieldCols[i] && i !== labelCol && !isEmpty(h)).map(String);
            const rows = body.map((r, i) => {
                const data = {};
                fieldCols.forEach((f, c) => { if (f) { const n = toNumber(r[c], eu); if (n !== null) data[f] = n; } });
                const label = labelCol >= 0 && !isEmpty(r[labelCol]) ? String(r[labelCol]).trim() : 'P' + (i + 1);
                return { label, data };
            });
            return { rows, unrecognized };
        }
        if (firstColHits >= 3) {
            const unrecognized = body.filter(r => !fieldOf(r[0]) && !isEmpty(r[0])).map(r => String(r[0]));
            const cols = [];
            header.forEach((h, c) => { if (c > 0 && !isEmpty(h)) cols.push(c); });
            if (!cols.length) throw new Error('No period columns found');
            const rows = cols.map(c => {
                const data = {};
                body.forEach(r => { const f = fieldOf(r[0]); if (f) { const n = toNumber(r[c], eu); if (n !== null) data[f] = n; } });
                let label = String(header[c]).trim();
                if (cols.length === 1 && /^(value|values|amount|wert)$/i.test(label)) label = fallbackLabel || 'Imported';
                return { label, data };
            });
            return { rows, unrecognized };
        }
        throw new Error('Could not recognise financial field names (e.g. Net Sales, Total Assets, Equity)');
    }

    // ─── nested JSON/XML/YAML -> matrix ───────────────────────
    function recordsToMatrix(recs) {
        const keys = [];
        recs.forEach(r => Object.keys(r).forEach(k => { if (!keys.includes(k)) keys.push(k); }));
        return [keys].concat(recs.map(r => keys.map(k => (isObj(r[k]) || Array.isArray(r[k])) ? '' : r[k])));
    }

    function fromValue(v, fallbackLabel, depth) {
        depth = depth || 0;
        if (depth > 4) throw new Error('Unrecognised structure');
        if (Array.isArray(v)) {
            if (v.length && v.every(Array.isArray)) return fromMatrix(v, fallbackLabel);
            const recs = v.filter(isObj);
            if (!recs.length) throw new Error('Unrecognised structure');
            return fromMatrix(recordsToMatrix(recs), fallbackLabel);
        }
        if (!isObj(v)) throw new Error('Unrecognised structure');
        const keys = Object.keys(v);
        const aliasKeys = keys.filter(k => fieldOf(k)).length;
        const nested = keys.filter(k => isObj(v[k]) || Array.isArray(v[k]));

        if (aliasKeys >= 3 && nested.length < aliasKeys) {
            // flat object of figures: a single period
            const data = {};
            keys.forEach(k => { const f = fieldOf(k); const n = f ? toNumber(v[k]) : null; if (n !== null) data[f] = n; });
            const lk = keys.find(k => PERIOD_KEYS.has(norm(k)) && !isObj(v[k]));
            return { rows: [{ label: lk ? String(v[lk]) : (fallbackLabel || 'Imported'), data }], unrecognized: keys.filter(k => !fieldOf(k) && k !== lk) };
        }
        if (nested.length && nested.every(k => isObj(v[k]))) {
            const objs = nested.map(k => v[k]);
            if (aliasKeys >= 3 || nested.filter(k => fieldOf(k)).length >= 3) {
                // field -> { period: value }
                const periodKeys = [];
                nested.forEach(k => Object.keys(v[k]).forEach(p => { if (!periodKeys.includes(p)) periodKeys.push(p); }));
                return fromMatrix([['field'].concat(periodKeys)].concat(nested.map(k => [k].concat(periodKeys.map(p => v[k][p])))), fallbackLabel);
            }
            if (objs.some(o => Object.keys(o).filter(k => fieldOf(k)).length >= 3)) {
                // period -> { field: value }
                return fromMatrix(recordsToMatrix(nested.map(k => Object.assign({ period: k }, v[k]))), fallbackLabel);
            }
        }
        if (nested.length) {
            const target = nested.length === 1 ? nested[0] : nested.find(k => Array.isArray(v[k]) && v[k].length) || nested[0];
            return fromValue(v[target], fallbackLabel, depth + 1);
        }
        throw new Error('Could not recognise financial field names');
    }

    // ─── format readers ───────────────────────────────────────
    function xmlToValue(node) {
        const kids = Array.from(node.children);
        const out = {};
        Array.from(node.attributes || []).forEach(a => { out[a.name] = a.value; });
        if (!kids.length) return Object.keys(out).length ? Object.assign(out, { value: node.textContent.trim() }) : node.textContent.trim();
        kids.forEach(k => {
            const val = xmlToValue(k);
            if (k.tagName in out) out[k.tagName] = [].concat(out[k.tagName], [val]);
            else out[k.tagName] = val;
        });
        return out;
    }

    const loaded = {};
    function loadScript(url) {
        loaded[url] = loaded[url] || new Promise((res, rej) => {
            const s = document.createElement('script');
            s.src = url; s.onload = res; s.onerror = () => rej(new Error('Could not load parser library (offline?)'));
            document.head.appendChild(s);
        });
        return loaded[url];
    }

    function parseJson(text, label) {
        let v;
        try { v = JSON.parse(text); } catch (e) {
            const lines = text.split(/\r?\n/).filter(l => l.trim());
            v = lines.map(l => JSON.parse(l)); // JSON Lines
        }
        return fromValue(v, label);
    }

    function parseDelimited(text, label) {
        const res = Papa.parse(text.replace(/^﻿/, '').trim(), { header: false, skipEmptyLines: true });
        return fromMatrix(res.data, label);
    }

    async function parseFile(file) {
        if (file.size > MAX_BYTES) throw new Error('File is larger than 5 MB');
        const ext = file.name.split('.').pop().toLowerCase();
        const label = file.name.replace(/\.[^.]+$/, '');
        if (['xlsx', 'xls', 'xlsm', 'ods'].includes(ext)) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
            const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
            let lastErr;
            for (const name of wb.SheetNames) {
                try {
                    const m = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: '' });
                    return fromMatrix(m, label);
                } catch (e) { lastErr = e; }
            }
            throw lastErr || new Error('Empty workbook');
        }
        const text = await file.text();
        return parseText(file.name, text);
    }

    // Text-based formats; also used directly by tests
    async function parseText(name, text) {
        const ext = name.split('.').pop().toLowerCase();
        const label = name.replace(/\.[^.]+$/, '');
        if (ext === 'json' || ext === 'jsonl' || ext === 'ndjson') return parseJson(text, label);
        if (ext === 'xml') {
            const doc = new DOMParser().parseFromString(text, 'application/xml');
            if (doc.querySelector('parsererror')) throw new Error('Invalid XML');
            return fromValue({ [doc.documentElement.tagName]: xmlToValue(doc.documentElement) }, label);
        }
        if (ext === 'yaml' || ext === 'yml') {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/js-yaml/4.1.0/js-yaml.min.js');
            return fromValue(jsyaml.load(text), label);
        }
        if (['csv', 'tsv', 'txt', 'tab', 'dat'].includes(ext)) return parseDelimited(text, label);
        throw new Error('Unsupported file type .' + ext);
    }

    // ─── finishing: derive missing totals, drop empty periods ─
    function finalize(parsed) {
        const periods = [], skipped = [];
        parsed.rows.forEach(({ label, data }) => {
            const d = Object.assign({}, data), derived = [];
            if (d.toplamBorclar == null && d.kisaVadeliBorclar != null && d.uzunVadeliBorclar != null) {
                d.toplamBorclar = d.kisaVadeliBorclar + d.uzunVadeliBorclar; derived.push('total liabilities');
            }
            if (d.ozkaynak == null && d.toplamAktif != null && d.toplamBorclar != null) {
                d.ozkaynak = d.toplamAktif - d.toplamBorclar; derived.push('equity');
            }
            if (d.toplamBorclar == null && d.toplamAktif != null && d.ozkaynak != null) {
                d.toplamBorclar = d.toplamAktif - d.ozkaynak; derived.push('total liabilities');
            }
            if (!(d.donenVarliklar || d.toplamAktif || d.netSatislar)) { skipped.push(label); return; }
            periods.push({ label, data: d, derived, fields: Object.keys(d).length });
        });
        return { periods, skipped, unrecognized: parsed.unrecognized || [] };
    }

    // Chronological order when every label carries a year (FY2024, 2024-Q3, 2024); else file order.
    function sortKey(label) {
        const y = /(19|20)\d{2}/.exec(label);
        if (!y) return null;
        const q = /q\s*([1-4])|([1-4])\s*q/i.exec(label);
        return +y[0] * 10 + (q ? +(q[1] || q[2]) : 0);
    }
    function chronological(periods) {
        const keys = periods.map(p => sortKey(p.label));
        if (keys.some(k => k === null)) return periods;
        return periods.map((p, i) => [keys[i], i, p]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2]);
    }

    const TEMPLATE = 'field,FY2023,FY2024,FY2025\n' + FIELDS.map(f => f + ',0,0,0').join('\n') + '\n';

    return { FIELDS, parseFile, parseText, finalize, chronological, toNumber, template: TEMPLATE,
        accept: '.csv,.tsv,.txt,.json,.jsonl,.ndjson,.xml,.yaml,.yml,.xlsx,.xls,.xlsm,.ods' };
})();
