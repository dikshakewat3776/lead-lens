import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, Field

from app.models import EmploymentType, ProductType


class LeadOut(BaseModel):
    id: uuid.UUID
    name: str
    email: str
    phone: str
    pincode: str
    product_type: ProductType
    loan_amount: Decimal
    monthly_income: Decimal
    employment_type: EmploymentType
    created_at: datetime

    model_config = {"from_attributes": True}


class PincodeCount(BaseModel):
    pincode: str
    count: int


class ProductDistribution(BaseModel):
    product_type: str
    count: int


class EmploymentDistribution(BaseModel):
    employment_type: str
    count: int


class PincodeMetadata(BaseModel):
    pincode: str
    lead_count: int
    avg_loan_amount: float | None
    median_loan_amount: float | None
    avg_monthly_income: float | None
    median_monthly_income: float | None
    most_common_product_type: str | None
    product_distribution: list[ProductDistribution]
    employment_distribution: list[EmploymentDistribution]


class LeadFilterBody(BaseModel):
    product_types: list[ProductType] | None = None
    employment_types: list[EmploymentType] | None = None
    pincode: str | None = Field(None, min_length=6, max_length=6)
    pincodes: list[str] | None = None
    min_loan_amount: Decimal | None = None
    max_loan_amount: Decimal | None = None
    min_monthly_income: Decimal | None = None
    max_monthly_income: Decimal | None = None
    created_after: datetime | None = None
    created_before: datetime | None = None
    page: int = Field(1, ge=1)
    page_size: int = Field(50, ge=1, le=500)


class PaginatedLeads(BaseModel):
    items: list[LeadOut]
    total: int
    page: int
    page_size: int
    pages: int


class CrossSellProductSuggestion(BaseModel):
    product_type: str
    reason: str
    affinity_score: float


class SimilarLeadOut(LeadOut):
    similarity_score: float
    suggested_products: list[CrossSellProductSuggestion] = []


class RecommendationResponse(BaseModel):
    pincode: str
    reference_summary: dict[str, Any]
    similar_leads: list[SimilarLeadOut]


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str
