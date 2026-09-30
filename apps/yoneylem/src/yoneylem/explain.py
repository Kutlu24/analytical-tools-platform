"""Writes the natural-language explanation of an ALREADY-COMPUTED
real result (from lp_solver.py or queueing.py). The LLM is given the exact
numbers and instructed to narrate them, not invent new ones - mirroring
the same real-number-first discipline used elsewhere in this account
(see e.g. GFCA's llm/synthesis.py). Supports Turkish and English output
via the `lang` parameter, matching whichever language the frontend's
language toggle is currently showing."""
from __future__ import annotations

from .llm import complete
from .models import LPFormulation, LPSolution, QueueingParams, QueueingResult

_SYSTEM = {
    "tr": """Sen bir yoneylem arastirmasi asistanisin. Sana GERCEKTEN COZULMUS bir \
optimizasyon veya kuyruk teorisi probleminin sonuclarini veriyorum - bu sayilar gercek bir \
solver/formul tarafindan hesaplandi, senin isin onlari Turkce, anlasilir bir sekilde \
aciklamak. Verilen sayilari degistirme veya yeni sayi uydurma - sadece verilenleri yorumla \
ve karar vericiye ne anlama geldigini anlat. Kisa ve net yaz.""",
    "en": """You are an operations research assistant. I am giving you the results of an \
optimization or queueing-theory problem that has ALREADY BEEN SOLVED - these numbers were \
computed by a real solver/formula, and your job is to explain them clearly in English. Do \
not change the given numbers or invent new ones - only interpret what is given and explain \
what it means for the decision-maker. Write short and clear.""",
}


def explain_lp(
    question: str, formulation: LPFormulation, solution: LPSolution, lang: str = "tr"
) -> str:
    lang = lang if lang in _SYSTEM else "tr"
    if lang == "en":
        user = (
            f"User's question: {question}\n\n"
            f"Model formulated: {formulation.sense} the objective function {formulation.objective}, "
            f"constraints: {[c.model_dump() for c in formulation.constraints]}, "
            f"integer variables: {formulation.integer_vars or 'none'}.\n\n"
            f"Real solver result: status={solution.status}, "
            f"optimal value={solution.objective_value}, "
            f"variable values={solution.variable_values}.\n\n"
            "Explain this real result in English: what is the optimal solution, what value "
            "did each variable take, and what value did the objective function reach."
        )
    else:
        user = (
            f"Kullanicinin sorusu: {question}\n\n"
            f"Kurulan model: {formulation.sense} etmek uzere amac fonksiyonu {formulation.objective}, "
            f"kisitlar: {[c.model_dump() for c in formulation.constraints]}, "
            f"tamsayi degiskenler: {formulation.integer_vars or 'yok'}.\n\n"
            f"Gercek solver sonucu: durum={solution.status}, "
            f"optimal deger={solution.objective_value}, "
            f"degisken degerleri={solution.variable_values}.\n\n"
            "Bu gercek sonucu Turkce acikla: optimal cozum nedir, hangi degiskenler ne deger aldi, "
            "amac fonksiyonunun degeri ne oldu."
        )
    return complete(_SYSTEM[lang], user)


def explain_queueing(
    question: str, params: QueueingParams, result: QueueingResult, lang: str = "tr"
) -> str:
    lang = lang if lang in _SYSTEM else "tr"

    if not result.stable:
        if lang == "en":
            user = (
                f"User's question: {question}\n\n"
                f"Parameters: arrival rate={params.arrival_rate}, service rate={params.service_rate}, "
                f"servers={params.servers}.\n\n"
                f"Real calculation: utilization (rho)={result.rho:.3f} >= 1 - the system is "
                "UNSTABLE (the queue grows without bound).\n\n"
                "Explain this real result in English: why the system is not stable, and what "
                "would need to change for it to become stable (more servers, a higher service "
                "rate, etc.)."
            )
        else:
            user = (
                f"Kullanicinin sorusu: {question}\n\n"
                f"Parametreler: varis orani={params.arrival_rate}, hizmet orani={params.service_rate}, "
                f"sunucu sayisi={params.servers}.\n\n"
                f"Gercek hesap: utilizasyon (rho)={result.rho:.3f} >= 1 - sistem KARARSIZ "
                "(kuyruk sinirsiz buyur).\n\n"
                "Bu gercek sonucu Turkce acikla: sistemin neden kararli olmadigini ve "
                "kararli hale gelmesi icin ne yapilmasi gerektigini (daha fazla sunucu, "
                "daha yuksek hizmet orani vb.) anlat."
            )
        return complete(_SYSTEM[lang], user)

    if lang == "en":
        user = (
            f"User's question: {question}\n\n"
            f"Parameters: arrival rate (lambda)={params.arrival_rate}, "
            f"service rate (mu)={params.service_rate}, servers={params.servers}, model={result.model}.\n\n"
            f"Real computed results: utilization (rho)={result.rho:.4f}, "
            f"average number of customers in the system (L)={result.L:.4f}, "
            f"average number of customers in the queue (Lq)={result.Lq:.4f}, "
            f"average time spent in the system (W)={result.W:.4f}, "
            f"average waiting time in the queue (Wq)={result.Wq:.4f}.\n\n"
            "Explain these real results in English, interpreting what the numbers mean in practice."
        )
    else:
        user = (
            f"Kullanicinin sorusu: {question}\n\n"
            f"Parametreler: varis orani (lambda)={params.arrival_rate}, "
            f"hizmet orani (mu)={params.service_rate}, sunucu sayisi={params.servers}, model={result.model}.\n\n"
            f"Gercek hesaplanmis sonuclar: utilizasyon (rho)={result.rho:.4f}, "
            f"sistemdeki ortalama musteri sayisi (L)={result.L:.4f}, "
            f"kuyruktaki ortalama musteri sayisi (Lq)={result.Lq:.4f}, "
            f"sistemde ortalama gecirilen sure (W)={result.W:.4f}, "
            f"kuyrukta ortalama bekleme suresi (Wq)={result.Wq:.4f}.\n\n"
            "Bu gercek sonuclari Turkce acikla, sayilarin pratikte ne anlama geldigini yorumla."
        )
    return complete(_SYSTEM[lang], user)
