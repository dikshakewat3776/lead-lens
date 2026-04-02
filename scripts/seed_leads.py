#!/usr/bin/env python3
"""Seed PostgreSQL with synthetic leads. Requires db/init.sql applied and DATABASE_URL."""

from __future__ import annotations

import asyncio
import os
import random
import sys
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import uuid4

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(ROOT, "backend"))

from faker import Faker
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.models import EmploymentType, Lead, ProductType

# ~45 Indian pincodes with approximate lat/lng for map demo (not exhaustive)
PINCODE_GEO = [
    ("110001", 28.6139, 77.2090),
    ("110092", 28.7041, 77.1025),
    ("400001", 19.0760, 72.8777),
    ("400050", 19.0544, 72.8406),
    ("560001", 12.9716, 77.5946),
    ("560076", 12.9352, 77.6245),
    ("600001", 13.0827, 80.2707),
    ("600040", 13.0067, 80.2206),
    ("700001", 22.5726, 88.3639),
    ("700016", 22.5186, 88.3562),
    ("380001", 23.0225, 72.5714),
    ("380015", 23.0304, 72.5089),
    ("411001", 18.5204, 73.8567),
    ("411014", 18.5074, 73.8077),
    ("500001", 17.3850, 78.4867),
    ("500081", 17.4483, 78.3915),
    ("302001", 26.9124, 75.7873),
    ("302019", 26.8538, 75.7648),
    ("226001", 26.8467, 80.9462),
    ("226010", 26.8726, 80.9150),
    ("682001", 9.9312, 76.2673),
    ("682030", 10.0159, 76.3410),
    ("641001", 11.0168, 76.9558),
    ("641012", 11.0293, 76.9445),
    ("452001", 22.7196, 75.8577),
    ("452010", 22.7500, 75.9000),
    ("834001", 23.3441, 85.3096),
    ("834008", 23.3703, 85.3250),
    ("492001", 21.2514, 81.6296),
    ("492014", 21.2787, 81.6318),
    ("781001", 26.1445, 91.7362),
    ("781022", 26.1209, 91.8010),
    ("795001", 24.8170, 93.9368),
    ("795010", 24.8048, 93.8890),
    ("793001", 25.5788, 91.8933),
    ("793004", 25.5650, 91.9000),
    ("737101", 27.3389, 88.6065),
    ("737103", 27.3500, 88.6200),
    ("744101", 11.9416, 92.9631),
    ("744102", 11.9500, 92.9700),
    ("403001", 15.2993, 74.1240),
    ("403002", 15.2700, 74.1300),
    ("462001", 23.2599, 77.4126),
    ("462042", 23.2200, 77.4300),
    ("160001", 30.7333, 76.7794),
    ("160022", 30.7500, 76.7800),
]

TOTAL_LEADS = 5000


async def main() -> None:
    # Default connection points to the `local` database; tables live in `lead_lens` schema.
    url = os.environ.get("DATABASE_URL", "postgresql+asyncpg://postgres:postgres@localhost:5432/local")
    engine = create_async_engine(url, echo=False)
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    fake = Faker("en_IN")
    random.seed(42)
    Faker.seed(42)

    products = list(ProductType)
    employments = list(EmploymentType)
    pincodes = [p[0] for p in PINCODE_GEO]

    async with Session() as session:
        await session.execute(delete(Lead))
        now = datetime.now(timezone.utc)
        batch: list[Lead] = []
        for i in range(TOTAL_LEADS):
            pc = random.choice(pincodes)
            pt = random.choice(products)
            et = random.choice(employments)
            loan = Decimal(str(round(random.lognormvariate(12, 0.5), 2))).quantize(Decimal("0.01"))
            inc = Decimal(str(round(random.lognormvariate(10.8, 0.45), 2))).quantize(Decimal("0.01"))
            if inc < 15000:
                inc = Decimal(str(random.randint(15000, 800000)))
            if loan < 50000:
                loan = Decimal(str(random.randint(50000, 5000000)))
            batch.append(
                Lead(
                    id=uuid4(),
                    name=fake.name(),
                    email=fake.unique.email(),
                    phone=fake.numerify("9#########"),
                    pincode=pc,
                    product_type=pt,
                    loan_amount=loan,
                    monthly_income=inc,
                    employment_type=et,
                    created_at=now - timedelta(days=random.randint(0, 730)),
                )
            )
            if len(batch) >= 500:
                session.add_all(batch)
                await session.commit()
                batch = []
        if batch:
            session.add_all(batch)
            await session.commit()

    await engine.dispose()
    print(f"Seeded {TOTAL_LEADS} leads into {url}")


if __name__ == "__main__":
    asyncio.run(main())
