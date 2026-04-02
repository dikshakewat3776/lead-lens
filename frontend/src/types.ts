export type ProductType =
  | "home_loan"
  | "business_loan"
  | "personal_loan"
  | "auto_loan"
  | "education_loan"
  | "gold_loan";

export type EmploymentType =
  | "salaried"
  | "self_employed"
  | "student"
  | "retired"
  | "homemaker";

export interface PincodeCount {
  pincode: string;
  count: number;
}

export interface ProductDistribution {
  product_type: string;
  count: number;
}

export interface EmploymentDistribution {
  employment_type: string;
  count: number;
}

export interface PincodeMetadata {
  pincode: string;
  lead_count: number;
  avg_loan_amount: number | null;
  median_loan_amount: number | null;
  avg_monthly_income: number | null;
  median_monthly_income: number | null;
  most_common_product_type: string | null;
  product_distribution: ProductDistribution[];
  employment_distribution: EmploymentDistribution[];
}

export interface LeadRow {
  id: string;
  name: string;
  email: string;
  phone: string;
  pincode: string;
  product_type: ProductType;
  loan_amount: string;
  monthly_income: string;
  employment_type: EmploymentType;
  created_at: string;
}

export interface PaginatedLeads {
  items: LeadRow[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PortfolioSummary {
  total_leads: number;
  by_product_type: { product_type: string; count: number }[];
  by_employment_type: { employment_type: string; count: number }[];
  by_income_band: { band: string; count: number }[];
}

export interface CrossSellProductSuggestion {
  product_type: string;
  reason: string;
  affinity_score: number;
}

export interface SimilarLead extends LeadRow {
  similarity_score: number;
  suggested_products: CrossSellProductSuggestion[];
}

export interface RecommendationResponse {
  pincode: string;
  reference_summary: Record<string, unknown>;
  similar_leads: SimilarLead[];
}

export interface GeoPin {
  pincode: string;
  lat: number;
  lng: number;
  label: string;
}
