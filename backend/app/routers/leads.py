import csv
import io
from collections import defaultdict
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import Select, and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.cache import cache_get, cache_set
from app.config import get_settings
from app.database import get_db
from app.deps import optional_user
from app.models import EmploymentType, Lead, ProductType
from app.schemas import (
    CrossSellProductSuggestion,
    LeadFilterBody,
    LeadOut,
    PaginatedLeads,
    PincodeCount,
    PincodeMetadata,
    ProductDistribution,
    EmploymentDistribution,
    RecommendationResponse,
    SimilarLeadOut,
)
from app.services.recommendation import find_similar_leads, suggested_products_for_pair

router = APIRouter(prefix="/api/leads", tags=["leads"])
settings = get_settings()


def _apply_filters(stmt: Select, body: LeadFilterBody) -> Select:
    conds = []
    if body.product_types:
        conds.append(Lead.product_type.in_(body.product_types))
    if body.employment_types:
        conds.append(Lead.employment_type.in_(body.employment_types))
    if body.pincode:
        conds.append(Lead.pincode == body.pincode)
    if body.pincodes:
        conds.append(Lead.pincode.in_(body.pincodes))
    if body.min_loan_amount is not None:
        conds.append(Lead.loan_amount >= body.min_loan_amount)
    if body.max_loan_amount is not None:
        conds.append(Lead.loan_amount <= body.max_loan_amount)
    if body.min_monthly_income is not None:
        conds.append(Lead.monthly_income >= body.min_monthly_income)
    if body.max_monthly_income is not None:
        conds.append(Lead.monthly_income <= body.max_monthly_income)
    if body.created_after is not None:
        conds.append(Lead.created_at >= body.created_after)
    if body.created_before is not None:
        conds.append(Lead.created_at <= body.created_before)
    if conds:
        stmt = stmt.where(and_(*conds))
    return stmt


@router.get("/count-by-pincode", response_model=list[PincodeCount])
async def count_by_pincode(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[str | None, Depends(optional_user)],
) -> list[PincodeCount]:
    cache_key = "leads:count-by-pincode"
    cached = await cache_get(cache_key)
    if cached is not None:
        return [PincodeCount(**row) for row in cached]

    stmt = select(Lead.pincode, func.count().label("count")).group_by(Lead.pincode).order_by(Lead.pincode)
    res = await db.execute(stmt)
    rows = [{"pincode": r[0], "count": int(r[1])} for r in res.all()]
    await cache_set(cache_key, rows)
    return [PincodeCount(**row) for row in rows]


@router.get("/metadata-by-pincode", response_model=list[PincodeMetadata])
async def metadata_by_pincode(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[str | None, Depends(optional_user)],
) -> list[PincodeMetadata]:
    cache_key = "leads:metadata-by-pincode"
    cached = await cache_get(cache_key)
    if cached is not None:
        return [PincodeMetadata(**row) for row in cached]

    base_stmt = (
        select(
            Lead.pincode,
            func.count().label("lead_count"),
            func.avg(Lead.loan_amount),
            func.percentile_cont(0.5).within_group(Lead.loan_amount.asc()),
            func.avg(Lead.monthly_income),
            func.percentile_cont(0.5).within_group(Lead.monthly_income.asc()),
        )
        .group_by(Lead.pincode)
        .order_by(Lead.pincode)
    )
    res = await db.execute(base_stmt)
    base_rows = {r[0]: r for r in res.all()}

    prod_stmt = (
        select(Lead.pincode, Lead.product_type, func.count().label("c"))
        .group_by(Lead.pincode, Lead.product_type)
    )
    res_p = await db.execute(prod_stmt)
    prod_map: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for pin, pt, c in res_p.all():
        prod_map[pin].append((pt.value if isinstance(pt, ProductType) else str(pt), int(c)))

    emp_stmt = (
        select(Lead.pincode, Lead.employment_type, func.count().label("c"))
        .group_by(Lead.pincode, Lead.employment_type)
    )
    res_e = await db.execute(emp_stmt)
    emp_map: dict[str, list[tuple[str, int]]] = defaultdict(list)
    for pin, et, c in res_e.all():
        emp_map[pin].append((et.value if isinstance(et, EmploymentType) else str(et), int(c)))

    out: list[PincodeMetadata] = []
    for pincode, row in base_rows.items():
        pcounts = prod_map.get(pincode, [])
        most_common = max(pcounts, key=lambda x: x[1])[0] if pcounts else None
        out.append(
            PincodeMetadata(
                pincode=pincode,
                lead_count=int(row[1]),
                avg_loan_amount=float(row[2]) if row[2] is not None else None,
                median_loan_amount=float(row[3]) if row[3] is not None else None,
                avg_monthly_income=float(row[4]) if row[4] is not None else None,
                median_monthly_income=float(row[5]) if row[5] is not None else None,
                most_common_product_type=most_common,
                product_distribution=[ProductDistribution(product_type=a, count=b) for a, b in sorted(pcounts, key=lambda x: -x[1])],
                employment_distribution=[EmploymentDistribution(employment_type=a, count=b) for a, b in sorted(emp_map.get(pincode, []), key=lambda x: -x[1])],
            )
        )

    payload = [m.model_dump() for m in out]
    await cache_set(cache_key, payload)
    return out


@router.get("/recommendation/{pincode}", response_model=RecommendationResponse)
async def recommendation(
    pincode: str,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[str | None, Depends(optional_user)],
    limit: int = Query(20, ge=1, le=100),
) -> RecommendationResponse:
    if len(pincode) != 6 or not pincode.isdigit():
        raise HTTPException(status_code=400, detail="Invalid Indian pincode (6 digits)")

    scored, summary = await find_similar_leads(db, pincode, limit=limit)
    refs = (await db.execute(select(Lead).where(Lead.pincode == pincode))).scalars().all()
    anchor = refs[0] if refs else None

    similar: list[SimilarLeadOut] = []
    for lead, score in scored:
        sug: list[CrossSellProductSuggestion] = []
        if anchor:
            for pt, reason, aff in suggested_products_for_pair(anchor, lead):
                sug.append(
                    CrossSellProductSuggestion(
                        product_type=pt.value,
                        reason=reason,
                        affinity_score=aff,
                    )
                )
        similar.append(
            SimilarLeadOut(
                id=lead.id,
                name=lead.name,
                email=lead.email,
                phone=lead.phone,
                pincode=lead.pincode,
                product_type=lead.product_type,
                loan_amount=lead.loan_amount,
                monthly_income=lead.monthly_income,
                employment_type=lead.employment_type,
                created_at=lead.created_at,
                similarity_score=round(score, 4),
                suggested_products=sug,
            )
        )

    return RecommendationResponse(pincode=pincode, reference_summary=summary, similar_leads=similar)


@router.post("/filter", response_model=PaginatedLeads)
async def filter_leads(
    body: LeadFilterBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[str | None, Depends(optional_user)],
) -> PaginatedLeads:
    base = _apply_filters(select(Lead), body)
    count_stmt = select(func.count()).select_from(base.subquery())
    total = int((await db.execute(count_stmt)).scalar_one())

    page = body.page
    page_size = body.page_size
    offset = (page - 1) * page_size

    stmt = base.order_by(Lead.created_at.desc()).offset(offset).limit(page_size)
    res = await db.execute(stmt)
    items = [LeadOut.model_validate(row) for row in res.scalars().all()]
    pages = (total + page_size - 1) // page_size if page_size else 0
    return PaginatedLeads(items=items, total=total, page=page, page_size=page_size, pages=pages)


@router.get("/portfolio-summary")
async def portfolio_summary(
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[str | None, Depends(optional_user)],
) -> dict:
    cache_key = "leads:portfolio-summary"
    cached = await cache_get(cache_key)
    if cached is not None:
        return cached

    total = int((await db.execute(select(func.count()).select_from(Lead))).scalar_one())

    by_product = await db.execute(
        select(Lead.product_type, func.count()).group_by(Lead.product_type)
    )
    by_emp = await db.execute(
        select(Lead.employment_type, func.count()).group_by(Lead.employment_type)
    )

    # Income bands (INR)
    bands = [
        ("0-50k", Lead.monthly_income < 50000),
        ("50k-1L", and_(Lead.monthly_income >= 50000, Lead.monthly_income < 100000)),
        ("1L-2L", and_(Lead.monthly_income >= 100000, Lead.monthly_income < 200000)),
        ("2L+", Lead.monthly_income >= 200000),
    ]
    income_counts = []
    for label, cond in bands:
        c = await db.execute(select(func.count()).select_from(Lead).where(cond))
        income_counts.append({"band": label, "count": int(c.scalar_one())})

    out = {
        "total_leads": total,
        "by_product_type": [{"product_type": r[0].value, "count": int(r[1])} for r in by_product.all()],
        "by_employment_type": [{"employment_type": r[0].value, "count": int(r[1])} for r in by_emp.all()],
        "by_income_band": income_counts,
    }
    await cache_set(cache_key, out)
    return out


@router.post("/export.csv")
async def export_csv(
    body: LeadFilterBody,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[str | None, Depends(optional_user)],
) -> StreamingResponse:
    """Export all leads matching filters (no pagination)."""
    base = select(Lead)
    base = _apply_filters(base, body)
    base = base.order_by(Lead.created_at.desc())
    res = await db.execute(base)
    rows = res.scalars().all()

    def iter_csv():
        buf = io.StringIO()
        w = csv.writer(buf)
        w.writerow(
            [
                "id",
                "name",
                "email",
                "phone",
                "pincode",
                "product_type",
                "loan_amount",
                "monthly_income",
                "employment_type",
                "created_at",
            ]
        )
        yield buf.getvalue()
        buf.seek(0)
        buf.truncate(0)
        for lead in rows:
            w.writerow(
                [
                    str(lead.id),
                    lead.name,
                    lead.email,
                    lead.phone,
                    lead.pincode,
                    lead.product_type.value,
                    str(lead.loan_amount),
                    str(lead.monthly_income),
                    lead.employment_type.value,
                    lead.created_at.isoformat() if lead.created_at else "",
                ]
            )
            yield buf.getvalue()
            buf.seek(0)
            buf.truncate(0)

    headers = {"Content-Disposition": 'attachment; filename="leads_export.csv"'}
    return StreamingResponse(iter_csv(), media_type="text/csv", headers=headers)
