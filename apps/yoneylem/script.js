// --- i18n: TR (default) + EN, toggled by the header language buttons and
// remembered in localStorage. STRINGS covers every data-i18n(-html) node in
// index.html plus runtime-only strings used directly by the solver's JS
// (status messages, result-box labels) that aren't tied to a static element.
const STRINGS = {
    tr: {
        pageTitle: "Optimizasyon Merkezi - Yöneylem Araştırması",
        brand: "Optimizasyon Merkezi",
        tagline: "Karar Vermeyi Bilimselleştirin!",
        navOverview: "Genel Bakış",
        navSolver: "Problem Çözücü",
        navTechniques: "Teknikler",
        navApplications: "Uygulama Alanları",
        navTools: "Araçlar",
        navResources: "Kaynaklar",
        navCommunity: "Topluluk",
        overviewP1: "Yöneylem araştırması (YA), karar verme süreçlerini iyileştirmek için matematiksel ve analitik yöntemlerin kullanıldığı bir disiplindir. İkinci Dünya Savaşı sırasında lojistik ve askeri planlama problemleri için geliştirilen yöntemler, günümüzde üretim planlama, ulaştırma, stok yönetimi, çizelgeleme ve kaynak tahsisi gibi pek çok alanda kullanılıyor.",
        overviewP2: "Bu sayfa, YA'nın dört temel tekniğine (doğrusal programlama, tamsayılı programlama, kuyruk teorisi, benzetim) kısa, matematiksel olarak doğru bir giriş sunar.",
        lpFigureOptimum: "optimum",
        lpFigureObjective: "z artış yönü",
        lpFigureCaption: "İki değişkenli bir doğrusal programda, kısıtların oluşturduğu gölgeli olurlu bölge (feasible region) ve amaç fonksiyonunun en iyi değeri aldığı köşe noktası (optimum).",
        solverIntro: "Problemini kendi cümlelerinle anlat - doğrusal/tamsayılı programlama (kâr/maliyet maksimize/minimize etme, kaynak kısıtları) veya kuyruk teorisi (varış/hizmet oranı, bekleme süresi) sorularını gerçek bir çözücü (PuLP/CBC) ve gerçek formüllerle çözer - cevap bir tahmin değil, gerçek hesaplanmış bir sonuçtur.",
        solverPlaceholder: "Örn: Bir fabrika iki ürün üretiyor... / Bir gişeye saatte ortalama 2 müşteri geliyor, hizmet oranı 5...",
        solverButton: "Çöz",
        techLP: "Doğrusal Programlama",
        techIP: "Tamsayılı Programlama",
        techQueue: "Kuyruk Teorisi",
        techSim: "Benzetim",
        footer: "© 2024 Optimizasyon Merkezi",
        applicationsList: `
            <li><strong>Üretim planlama:</strong> Sınırlı makine/işgücü kapasitesiyle üretim karmasını optimize etme.</li>
            <li><strong>Ulaştırma ve lojistik:</strong> Depo-müşteri arası en düşük maliyetli sevkiyat planı (taşıma problemi).</li>
            <li><strong>Stok yönetimi:</strong> Sipariş miktarı ve zamanlamasını, elde bulundurma ve sipariş maliyetlerini dengeleyerek belirleme.</li>
            <li><strong>Personel çizelgeleme:</strong> Vardiya/talep kısıtları altında en az sayıda personelle hizmet düzeyini karşılama.</li>
            <li><strong>Hizmet sistemleri:</strong> Çağrı merkezi, banka gişesi, acil servis gibi sistemlerde bekleme süresi ve kapasite planlaması.</li>
        `,
        toolsList: `
            <li><strong>Solver çözücüler:</strong> CPLEX, Gurobi, CBC — büyük ölçekli DP/TP problemleri için endüstri standardı çözücüler.</li>
            <li><strong>Python:</strong> <code>PuLP</code> ve <code>Pyomo</code> kütüphaneleri ile modelleme; <code>SimPy</code> ile olay-güdümlü benzetim.</li>
            <li><strong>R:</strong> <code>lpSolve</code> ve <code>ompr</code> paketleri ile doğrusal/tamsayılı programlama.</li>
            <li><strong>Elektronik tablo:</strong> Excel Solver eklentisi — küçük ölçekli DP problemleri için hızlı bir başlangıç noktası.</li>
        `,
        resourcesList: `
            <li>
                <a href="https://neos-guide.org/" target="_blank" rel="noopener">NEOS Guide to Optimization</a>
                <span>Optimizasyon problemi türlerine ve çözüm yöntemlerine genel bakış.</span>
            </li>
            <li>
                <a href="https://www.informs.org/" target="_blank" rel="noopener">INFORMS</a>
                <span>Yöneylem araştırması ve yönetim bilimleri alanının uluslararası meslek kuruluşu.</span>
            </li>
            <li>
                <a href="https://coin-or.github.io/pulp/" target="_blank" rel="noopener">PuLP Dokümantasyonu</a>
                <span>Python ile doğrusal/tamsayılı programlama modelleme kütüphanesi.</span>
            </li>
        `,
        communityP: `Bu site şu an bağımsız bir statik sayfa olduğu için kendi forum altyapısı yok. Sorularınız için <a href="https://or.stackexchange.com/" target="_blank" rel="noopener">Operations Research Stack Exchange</a> topluluğunu öneririz.`,

        // runtime-only (not tied to a data-i18n element)
        modelBadgeTpl: "Aktif model: {provider} / {model}",
        techDefault: "<p>Lütfen yukarıdan bir teknik seçin.</p>",
        solving: "Problem ayrıştırılıyor ve gerçek çözücüyle hesaplanıyor - 10-40 sn sürebilir...",
        errorPrefix: "Hata: ",
        lpResultTitle: "Gerçek Solver Sonucu (PuLP/CBC)",
        lpStatus: "Durum:",
        lpOptimal: "Optimal değer:",
        queueResultTitle: (model) => `Gerçek Hesap (${model})`,
        queueUnstable: (rho) => `Utilizasyon (ρ) = ${rho} ≥ 1 - sistem <strong>KARARSIZ</strong>.`,
        queueRho: "ρ (utilizasyon) =",
        queueL: "L (sistemde ort. müşteri) =",
        queueLq: "Lq (kuyrukta ort. müşteri) =",
        queueW: "W (sistemde ort. süre) =",
        queueWq: "Wq (kuyrukta ort. bekleme) =",
    },
    en: {
        pageTitle: "Operations Research Center - OR Reference & Solver",
        brand: "Operations Research Center",
        tagline: "Make decision-making scientific.",
        navOverview: "Overview",
        navSolver: "Problem Solver",
        navTechniques: "Techniques",
        navApplications: "Application Areas",
        navTools: "Tools",
        navResources: "Resources",
        navCommunity: "Community",
        overviewP1: "Operations research (OR) is a discipline that applies mathematical and analytical methods to improve decision-making. Techniques developed during World War II for logistics and military planning are used today across production planning, transportation, inventory management, scheduling, and resource allocation.",
        overviewP2: "This page gives a short, mathematically accurate introduction to OR's four core techniques: linear programming, integer programming, queueing theory, and simulation.",
        lpFigureOptimum: "optimum",
        lpFigureObjective: "direction of increasing z",
        lpFigureCaption: "In a two-variable linear program, the shaded feasible region formed by the constraints, and the vertex (optimum) where the objective function reaches its best value.",
        solverIntro: "Describe your problem in your own words - linear/integer programming questions (maximizing/minimizing profit or cost, resource constraints) or queueing-theory questions (arrival/service rate, waiting time) are solved with a real solver (PuLP/CBC) and real formulas - the answer is a genuinely computed result, not a guess.",
        solverPlaceholder: "E.g.: A factory makes two products... / On average 2 customers arrive at a counter per hour, service rate is 5...",
        solverButton: "Solve",
        techLP: "Linear Programming",
        techIP: "Integer Programming",
        techQueue: "Queueing Theory",
        techSim: "Simulation",
        footer: "© 2024 Operations Research Center",
        applicationsList: `
            <li><strong>Production planning:</strong> optimizing the product mix under limited machine/labor capacity.</li>
            <li><strong>Transportation & logistics:</strong> the lowest-cost warehouse-to-customer shipping plan (the transportation problem).</li>
            <li><strong>Inventory management:</strong> determining order quantity and timing by balancing holding and ordering costs.</li>
            <li><strong>Staff scheduling:</strong> meeting a service level with the fewest staff, under shift/demand constraints.</li>
            <li><strong>Service systems:</strong> waiting-time and capacity planning for systems like call centers, bank counters, and emergency rooms.</li>
        `,
        toolsList: `
            <li><strong>Solvers:</strong> CPLEX, Gurobi, CBC — industry-standard solvers for large-scale LP/IP problems.</li>
            <li><strong>Python:</strong> modeling with the <code>PuLP</code> and <code>Pyomo</code> libraries; discrete-event simulation with <code>SimPy</code>.</li>
            <li><strong>R:</strong> linear/integer programming with the <code>lpSolve</code> and <code>ompr</code> packages.</li>
            <li><strong>Spreadsheet:</strong> the Excel Solver add-in — a quick starting point for small-scale LP problems.</li>
        `,
        resourcesList: `
            <li>
                <a href="https://neos-guide.org/" target="_blank" rel="noopener">NEOS Guide to Optimization</a>
                <span>An overview of optimization problem types and solution methods.</span>
            </li>
            <li>
                <a href="https://www.informs.org/" target="_blank" rel="noopener">INFORMS</a>
                <span>The international professional society for operations research and management science.</span>
            </li>
            <li>
                <a href="https://coin-or.github.io/pulp/" target="_blank" rel="noopener">PuLP Documentation</a>
                <span>A Python library for linear/integer programming models.</span>
            </li>
        `,
        communityP: `This site is currently an independent static page, so it has no forum of its own. For questions, we recommend the <a href="https://or.stackexchange.com/" target="_blank" rel="noopener">Operations Research Stack Exchange</a> community.`,

        modelBadgeTpl: "Active model: {provider} / {model}",
        techDefault: "<p>Please select a technique above.</p>",
        solving: "Parsing the problem and computing it with a real solver - this can take 10-40s...",
        errorPrefix: "Error: ",
        lpResultTitle: "Real Solver Result (PuLP/CBC)",
        lpStatus: "Status:",
        lpOptimal: "Optimal value:",
        queueResultTitle: (model) => `Real Calculation (${model})`,
        queueUnstable: (rho) => `Utilization (ρ) = ${rho} ≥ 1 - the system is <strong>UNSTABLE</strong>.`,
        queueRho: "ρ (utilization) =",
        queueL: "L (avg. customers in system) =",
        queueLq: "Lq (avg. customers in queue) =",
        queueW: "W (avg. time in system) =",
        queueWq: "Wq (avg. waiting time in queue) =",
    },
};

// Technique reference cards, kept separate from STRINGS since they're
// injected by category rather than tied to a single static element. The
// LaTeX standard forms are language-agnostic and reused as-is in both.
const TEKNIK_ICERIK = {
    tr: {
        "dogrusal-programlama": `
            <h3>Doğrusal Programlama (DP)</h3>
            <p>Doğrusal programlama, doğrusal bir amaç fonksiyonunu, doğrusal eşitlik/eşitsizlik kısıtları altında optimize etmek için kullanılan bir matematiksel modelleme tekniğidir.</p>
            <p><strong>Standart Form:</strong></p>
            <p>\\[ \\text{maks. } z = c^T x \\quad \\text{öyle ki} \\quad Ax \\le b, \\quad x \\ge 0 \\]</p>
            <p><strong>Çözüm Yöntemleri:</strong> Simpleks yöntemi (Dantzig, 1947), iç nokta yöntemleri; iki değişkenli problemler için grafiksel çözüm.</p>
            <p><strong>Örnek Problem:</strong> Bir fabrika iki ürün üretiyor; her ürün belirli miktarda işçilik ve hammadde tüketiyor. Kısıtlı kaynaklarla kârı maksimize eden üretim karması, \\( \\text{maks. } z = 40x_1 + 30x_2 \\) şeklinde, kaynak kısıtları altında bulunur.</p>
        `,
        "tamsayili-programlama": `
            <h3>Tamsayılı Programlama (TP)</h3>
            <p>Tamsayılı programlama, karar değişkenlerinin tamsayı (bazen sadece 0/1) değerler alması gerektiği durumlarda kullanılan bir optimizasyon tekniğidir — örneğin "bu tesisi kur ya da kurma" gibi bölünemez kararlarda.</p>
            <p><strong>Standart Form:</strong></p>
            <p>\\[ \\text{maks. } z = c^T x \\quad \\text{öyle ki} \\quad Ax \\le b, \\quad x \\in \\mathbb{Z}_{\\ge 0}^n \\]</p>
            <p><strong>Çözüm Yöntemleri:</strong> Dallan-ve-sınırla (branch and bound), kesme düzlemi (cutting plane) yöntemleri; 0/1 değişkenli özel durum "ikili (binary) programlama" olarak anılır.</p>
            <p><strong>Örnek Problem:</strong> Sabit sayıda depo adayı arasından, açılış maliyeti ile taşıma maliyetini birlikte minimize edecek şekilde hangi depoların açılacağına karar veren "tesis yeri seçimi" (facility location) problemi.</p>
        `,
        "kuyruk-teorisi": `
            <h3>Kuyruk Teorisi</h3>
            <p>Kuyruk teorisi, müşterilerin (kişi, çağrı, iş parçası) bir hizmet noktasına rastgele aralıklarla geldiği ve rastgele sürede hizmet aldığı sistemlerin davranışını analiz eder.</p>
            <p><strong>M/M/1 Modeli:</strong> Poisson varışlı (\\(\\lambda\\)), üstel hizmet süreli (\\(\\mu\\)), tek sunuculu kuyruk için sistemdeki ortalama müşteri sayısı:</p>
            <p>\\[ L = \\frac{\\rho}{1-\\rho}, \\qquad \\rho = \\frac{\\lambda}{\\mu} \\]</p>
            <p><strong>Performans Ölçütleri:</strong> Ortalama bekleme süresi (\\(W_q\\)), sistemdeki ortalama müşteri sayısı (\\(L\\)), sunucu doluluk oranı (\\(\\rho\\)) — Little Yasası \\(L = \\lambda W\\) ile birbirine bağlanır.</p>
            <p><strong>Örnek Uygulamalar:</strong> Çağrı merkezi personel sayısı belirleme, banka gişe sayısı optimizasyonu, hastane acil servis kapasite planlaması.</p>
        `,
        benzetim: `
            <h3>Benzetim (Simülasyon)</h3>
            <p>Benzetim, analitik olarak çözülmesi zor veya imkansız olan karmaşık sistemlerin davranışını, bilgisayar üzerinde zaman içinde adım adım taklit ederek incelemek için kullanılan bir tekniktir.</p>
            <p><strong>Yaygın Teknikler:</strong> Olay-güdümlü benzetim (discrete-event simulation), Monte Carlo benzetimi, ajan-tabanlı modelleme.</p>
            <p><strong>Modelleme Adımları:</strong> Sistemi tanımlama → rastgele değişkenlerin dağılımını belirleme (varış süresi, hizmet süresi vb.) → benzetim modelini kurma → çok sayıda tekrar (replikasyon) ile sonuçların güven aralığını hesaplama.</p>
            <p><strong>Örnek Uygulamalar:</strong> Üretim hattı darboğaz analizi, hastane yatak kapasitesi planlaması, tedarik zinciri stok politikalarının karşılaştırılması.</p>
        `,
    },
    en: {
        "dogrusal-programlama": `
            <h3>Linear Programming (LP)</h3>
            <p>Linear programming is a mathematical modeling technique used to optimize a linear objective function subject to linear equality/inequality constraints.</p>
            <p><strong>Standard Form:</strong></p>
            <p>\\[ \\text{max. } z = c^T x \\quad \\text{s.t.} \\quad Ax \\le b, \\quad x \\ge 0 \\]</p>
            <p><strong>Solution Methods:</strong> the Simplex method (Dantzig, 1947), interior-point methods; graphical solution for two-variable problems.</p>
            <p><strong>Example Problem:</strong> A factory produces two products, each consuming a certain amount of labor and raw material. The product mix that maximizes profit under limited resources is found as \\( \\text{max. } z = 40x_1 + 30x_2 \\), subject to the resource constraints.</p>
        `,
        "tamsayili-programlama": `
            <h3>Integer Programming (IP)</h3>
            <p>Integer programming is an optimization technique used when decision variables must take integer (sometimes 0/1 only) values — for example, indivisible decisions like "build this facility or don't."</p>
            <p><strong>Standard Form:</strong></p>
            <p>\\[ \\text{max. } z = c^T x \\quad \\text{s.t.} \\quad Ax \\le b, \\quad x \\in \\mathbb{Z}_{\\ge 0}^n \\]</p>
            <p><strong>Solution Methods:</strong> branch and bound, cutting-plane methods; the special case with 0/1 variables is called "binary programming."</p>
            <p><strong>Example Problem:</strong> The "facility location" problem — choosing which warehouses to open, among a fixed set of candidate sites, so as to jointly minimize opening cost and transportation cost.</p>
        `,
        "kuyruk-teorisi": `
            <h3>Queueing Theory</h3>
            <p>Queueing theory analyzes the behavior of systems where customers (people, calls, jobs) arrive at a service point at random intervals and are served for a random duration.</p>
            <p><strong>M/M/1 Model:</strong> for a single-server queue with Poisson arrivals (\\(\\lambda\\)) and exponential service times (\\(\\mu\\)), the average number of customers in the system is:</p>
            <p>\\[ L = \\frac{\\rho}{1-\\rho}, \\qquad \\rho = \\frac{\\lambda}{\\mu} \\]</p>
            <p><strong>Performance Measures:</strong> average waiting time (\\(W_q\\)), average number of customers in the system (\\(L\\)), server utilization (\\(\\rho\\)) — linked together by Little's Law \\(L = \\lambda W\\).</p>
            <p><strong>Example Applications:</strong> sizing call-center staffing, optimizing the number of bank counters, hospital emergency-room capacity planning.</p>
        `,
        benzetim: `
            <h3>Simulation</h3>
            <p>Simulation is a technique for studying the behavior of complex systems that are difficult or impossible to solve analytically, by imitating them step by step over time on a computer.</p>
            <p><strong>Common Techniques:</strong> discrete-event simulation, Monte Carlo simulation, agent-based modeling.</p>
            <p><strong>Modeling Steps:</strong> define the system → determine the distributions of the random variables (arrival time, service time, etc.) → build the simulation model → run many replications to compute a confidence interval for the results.</p>
            <p><strong>Example Applications:</strong> production-line bottleneck analysis, hospital bed-capacity planning, comparing supply-chain inventory policies.</p>
        `,
    },
};

let currentLang = localStorage.getItem("yoneylem_lang") || "tr";
let currentTeknikKategori = "";

function applyLang(lang) {
    currentLang = lang;
    localStorage.setItem("yoneylem_lang", lang);
    document.documentElement.lang = lang;

    const s = STRINGS[lang];

    document.querySelectorAll("[data-i18n]").forEach((el) => {
        const key = el.getAttribute("data-i18n");
        if (s[key] !== undefined) {
            if (el.tagName === "TITLE") {
                el.textContent = s[key];
            } else {
                el.textContent = s[key];
            }
        }
    });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
        const key = el.getAttribute("data-i18n-html");
        if (s[key] !== undefined) el.innerHTML = s[key];
    });
    document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
        const key = el.getAttribute("data-i18n-placeholder");
        if (s[key] !== undefined) el.setAttribute("placeholder", s[key]);
    });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.langBtn === lang);
    });

    // Re-render the currently-open technique card (if any) in the new language
    teknikIcerigiYukle(currentTeknikKategori);
    // Refresh the model badge template
    cozucuConfigYukle();
}

function teknikIcerigiYukle(kategori) {
    const teknikIcerik = document.getElementById("teknik-icerik");
    if (!teknikIcerik) return;
    currentTeknikKategori = kategori;
    const icerik = (kategori && TEKNIK_ICERIK[currentLang][kategori]) || STRINGS[currentLang].techDefault;
    teknikIcerik.innerHTML = icerik;

    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([teknikIcerik]).catch(function (err) {
            console.log(err.message);
        });
    }
}

document.addEventListener("DOMContentLoaded", function() {
    const teknikKategorileri = document.querySelector(".teknik-kategorileri");
    teknikKategorileri.addEventListener("click", function(event) {
        if (event.target.tagName === "BUTTON") {
            teknikIcerigiYukle(event.target.dataset.kategori);
        }
    });

    document.querySelectorAll(".lang-btn").forEach((btn) => {
        btn.addEventListener("click", () => applyLang(btn.dataset.langBtn));
    });

    applyLang(currentLang);
});

// --- Problem Çözücü (gerçek PuLP/kuyruk-teorisi backend'i, ayrı, global scope -
// index.html'deki onclick="cozProblemi()" buna erişebilsin diye yukarıdaki
// DOMContentLoaded kapanışının dışında tanımlandı) ---
const COZUCU_API = "/yoneylem";

async function cozucuConfigYukle() {
    try {
        const cfg = await (await fetch(`${COZUCU_API}/config`)).json();
        document.getElementById("modelBadge").textContent = STRINGS[currentLang].modelBadgeTpl
            .replace("{provider}", cfg.provider).replace("{model}", cfg.model);
    } catch {
        document.getElementById("modelBadge").textContent = "";
    }
}

function fmtSayi(v) {
    if (v === null || v === undefined) return "-";
    if (!isFinite(v)) return "∞";
    return Number(v).toFixed(4).replace(/\.?0+$/, "") || "0";
}

function renderLpSonuc(sol) {
    const s = STRINGS[currentLang];
    const degiskenler = Object.entries(sol.variable_values)
        .map(([k, v]) => `<span class="lp-degisken"><strong>${k}</strong> = ${fmtSayi(v)}</span>`)
        .join("");
    return `
        <div class="sonuc-kutusu">
            <div class="sonuc-baslik">${s.lpResultTitle}</div>
            <div class="sonuc-satir">${s.lpStatus} <strong>${sol.status}</strong></div>
            <div class="sonuc-satir">${s.lpOptimal} <strong>${fmtSayi(sol.objective_value)}</strong></div>
            <div class="lp-degiskenler">${degiskenler}</div>
        </div>`;
}

function renderQueueSonuc(r) {
    const s = STRINGS[currentLang];
    if (!r.stable) {
        return `<div class="sonuc-kutusu sonuc-uyari">
            <div class="sonuc-baslik">${s.queueResultTitle(r.model.toUpperCase())}</div>
            <div class="sonuc-satir">${s.queueUnstable(fmtSayi(r.rho))}</div>
        </div>`;
    }
    return `
        <div class="sonuc-kutusu">
            <div class="sonuc-baslik">${s.queueResultTitle(r.model.toUpperCase())}</div>
            <div class="sonuc-satir">${s.queueRho} <strong>${fmtSayi(r.rho)}</strong></div>
            <div class="sonuc-satir">${s.queueL} <strong>${fmtSayi(r.L)}</strong></div>
            <div class="sonuc-satir">${s.queueLq} <strong>${fmtSayi(r.Lq)}</strong></div>
            <div class="sonuc-satir">${s.queueW} <strong>${fmtSayi(r.W)}</strong></div>
            <div class="sonuc-satir">${s.queueWq} <strong>${fmtSayi(r.Wq)}</strong></div>
        </div>`;
}

async function cozProblemi() {
    const s = STRINGS[currentLang];
    const soru = document.getElementById("cozucuSoru").value.trim();
    if (!soru) return;
    const durumEl = document.getElementById("cozucuDurum");
    const btn = document.getElementById("cozucuBtn");
    const sonucEl = document.getElementById("cozucuSonuc");
    btn.disabled = true;
    durumEl.textContent = s.solving;
    sonucEl.innerHTML = "";

    try {
        const res = await fetch(`${COZUCU_API}/solve`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: soru, lang: currentLang }),
        });
        if (!res.ok) {
            let msg = await res.text();
            try { msg = JSON.parse(msg).detail || msg; } catch {}
            durumEl.textContent = s.errorPrefix + msg;
            return;
        }
        const data = await res.json();
        durumEl.textContent = "";

        if (data.problem_type === "lp" && data.lp_solution) {
            sonucEl.innerHTML = renderLpSonuc(data.lp_solution) +
                `<div class="sonuc-aciklama">${data.explanation.replace(/\n/g, "<br>")}</div>`;
        } else if (data.problem_type === "queueing" && data.queueing_result) {
            sonucEl.innerHTML = renderQueueSonuc(data.queueing_result) +
                `<div class="sonuc-aciklama">${data.explanation.replace(/\n/g, "<br>")}</div>`;
        } else {
            sonucEl.innerHTML = `<div class="sonuc-kutusu sonuc-uyari"><div class="sonuc-satir">${data.clarification_needed}</div></div>`;
        }
    } catch (e) {
        durumEl.textContent = s.errorPrefix + e.message;
    } finally {
        btn.disabled = false;
    }
}
