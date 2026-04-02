"""Cross-sell and similarity scoring for leads."""

from __future__ import annotations

import math
from decimal import Decimal
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Lead, ProductType

# Products to suggest when anchor has a different product (cross-sell)
CROSS_SELL_MATRIX: dict[ProductType, list[ProductType]] = {
    ProductType.home_loan: [ProductType.personal_loan, ProductType.auto_loan, ProductType.gold_loan],
    ProductType.business_loan: [ProductType.personal_loan, ProductType.gold_loan],
    ProductType.personal_loan: [ProductType.home_loan, ProductType.auto_loan],
    ProductType.auto_loan: [ProductType.personal_loan, ProductType.gold_loan],
    ProductType.education_loan: [ProductType.personal_loan],
    ProductType.gold_loan: [ProductType.personal_loan, ProductType.business_loan],
}


def _norm_loan(x: Decimal | float) -> float:
    return float(math.log1p(max(float(x), 0.0)))


def _norm_income(x: Decimal | float) -> float:
    return float(math.log1p(max(float(x), 1.0)))


def similarity_score(a: Lead, b: Lead) -> float:
    """Higher is more similar (0..1 scale approx)."""
    dl = abs(_norm_loan(a.loan_amount) - _norm_loan(b.loan_amount))
    di = abs(_norm_income(a.monthly_income) - _norm_income(b.monthly_income)) * 0.5
    emp_bonus = 0.15 if a.employment_type == b.employment_type else 0.0
    # penalize distance; dampen with scale
    dist = dl + di
    base = 1.0 / (1.0 + dist)
    return min(1.0, base + emp_bonus)


def suggested_products_for_pair(anchor: Lead, candidate: Lead) -> list[tuple[ProductType, str, float]]:
    out: list[tuple[ProductType, str, float]] = []
    if candidate.product_type == anchor.product_type:
        for p in CROSS_SELL_MATRIX.get(anchor.product_type, []):
            if p != anchor.product_type:
                out.append(
                    (
                        p,
                        f"Customers with {anchor.product_type.value.replace('_', ' ')} "
                        f"often qualify for {p.value.replace('_', ' ')}.",
                        0.72,
                    )
                )
        return out[:3]
    # Different product already — suggest complementary
    for p in CROSS_SELL_MATRIX.get(candidate.product_type, [])[:2]:
        out.append(
            (
                p,
                f"Based on similar profile to this {candidate.product_type.value.replace('_', ' ')} lead.",
                0.65,
            )
        )
    return out[:3]


async def find_similar_leads(
    session: AsyncSession,
    pincode: str,
    limit: int = 25,
    candidate_pool: int = 2500,
) -> tuple[list[tuple[Lead, float]], dict]:
    """Return (similar_leads_with_scores, reference_summary) for a pincode."""
    q_ref = select(Lead).where(Lead.pincode == pincode)
    res = await session.execute(q_ref)
    refs = list(res.scalars().all())
    if not refs:
        return [], {"pincode": pincode, "lead_count": 0}

    avg_loan = sum(float(r.loan_amount) for r in refs) / len(refs)
    avg_inc = sum(float(r.monthly_income) for r in refs) / len(refs)

    summary = {
        "pincode": pincode,
        "lead_count": len(refs),
        "avg_loan_amount": avg_loan,
        "avg_monthly_income": avg_inc,
    }

    q_all = (
        select(Lead)
        .where(Lead.pincode != pincode)
        .order_by(Lead.created_at.desc())
        .limit(candidate_pool)
    )
    res_all = await session.execute(q_all)
    candidates = list(res_all.scalars().all())

    q_same = select(Lead).where(Lead.pincode == pincode).limit(500)
    res_same = await session.execute(q_same)
    same_pc = list(res_same.scalars().all())
    cand_ids = {c.id for c in candidates}
    for row in same_pc:
        if row.id not in cand_ids:
            candidates.append(row)
            cand_ids.add(row.id)

    scored: list[tuple[Lead, float]] = []
    anchor = refs[0]
    seen: set = set()
    for cand in candidates:
        if cand.id in seen:
            continue
        seen.add(cand.id)
        scores = [similarity_score(ref, cand) for ref in refs[:12]]
        s = sum(scores) / max(len(scores), 1)
        if cand.pincode == pincode and cand.id == anchor.id:
            continue
        scored.append((cand, float(s)))

    scored.sort(key=lambda x: -x[1])
    return scored[:limit], summary
