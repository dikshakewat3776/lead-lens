import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import ENUM as PG_ENUM
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class ProductType(str, enum.Enum):
    home_loan = "home_loan"
    business_loan = "business_loan"
    personal_loan = "personal_loan"
    auto_loan = "auto_loan"
    education_loan = "education_loan"
    gold_loan = "gold_loan"


class EmploymentType(str, enum.Enum):
    salaried = "salaried"
    self_employed = "self_employed"
    student = "student"
    retired = "retired"
    homemaker = "homemaker"


_product_type_col = PG_ENUM(
    ProductType,
    name="product_type_enum",
    schema="lead_lens",
    create_type=False,
    values_callable=lambda obj: [e.value for e in obj],
)
_employment_type_col = PG_ENUM(
    EmploymentType,
    name="employment_type_enum",
    schema="lead_lens",
    create_type=False,
    values_callable=lambda obj: [e.value for e in obj],
)


class Lead(Base):
    __tablename__ = "leads"
    # All lead data (and enum types) live under the `lead_lens` schema.
    __table_args__ = {"schema": "lead_lens"}

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(Text, nullable=False)
    email: Mapped[str] = mapped_column(Text, nullable=False)
    phone: Mapped[str] = mapped_column(Text, nullable=False)
    pincode: Mapped[str] = mapped_column(String(6), nullable=False, index=True)
    product_type: Mapped[ProductType] = mapped_column(_product_type_col, nullable=False)
    loan_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    monthly_income: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    employment_type: Mapped[EmploymentType] = mapped_column(_employment_type_col, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
