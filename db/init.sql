-- Lead Lens schema (run once before app)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE SCHEMA IF NOT EXISTS lead_lens;

DO $$ BEGIN
    CREATE TYPE lead_lens.product_type_enum AS ENUM (
        'home_loan', 'business_loan', 'personal_loan', 'auto_loan',
        'education_loan', 'gold_loan'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE lead_lens.employment_type_enum AS ENUM (
        'salaried', 'self_employed', 'student', 'retired', 'homemaker'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS lead_lens.leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT NOT NULL,
    pincode VARCHAR(6) NOT NULL,
    product_type lead_lens.product_type_enum NOT NULL,
    loan_amount NUMERIC(14, 2) NOT NULL,
    monthly_income NUMERIC(14, 2) NOT NULL,
    employment_type lead_lens.employment_type_enum NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_pincode ON lead_lens.leads (pincode);
CREATE INDEX IF NOT EXISTS idx_leads_product_type ON lead_lens.leads (product_type);
CREATE INDEX IF NOT EXISTS idx_leads_employment_type ON lead_lens.leads (employment_type);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON lead_lens.leads (created_at);


