import axios from "axios";
import type {
  PaginatedLeads,
  PincodeCount,
  PincodeMetadata,
  PortfolioSummary,
  RecommendationResponse,
} from "./types";

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
  timeout: 120000,
});

export function setAuthToken(token: string | null) {
  if (token) {
    client.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete client.defaults.headers.common.Authorization;
  }
}

export async function fetchCountByPincode(): Promise<PincodeCount[]> {
  const { data } = await client.get<PincodeCount[]>("/api/leads/count-by-pincode");
  return data;
}

export async function fetchMetadataByPincode(): Promise<PincodeMetadata[]> {
  const { data } = await client.get<PincodeMetadata[]>("/api/leads/metadata-by-pincode");
  return data;
}

export async function fetchPortfolio(): Promise<PortfolioSummary> {
  const { data } = await client.get<PortfolioSummary>("/api/leads/portfolio-summary");
  return data;
}

export async function fetchLeadsFilter(body: Record<string, unknown>): Promise<PaginatedLeads> {
  const { data } = await client.post<PaginatedLeads>("/api/leads/filter", body);
  return data;
}

export async function fetchRecommendation(pincode: string): Promise<RecommendationResponse> {
  const { data } = await client.get<RecommendationResponse>(
    `/api/leads/recommendation/${encodeURIComponent(pincode)}`,
  );
  return data;
}

export async function exportCsv(body: Record<string, unknown>): Promise<Blob> {
  const { data } = await client.post<Blob>("/api/leads/export.csv", body, { responseType: "blob" });
  return data;
}

export async function login(username: string, password: string): Promise<string> {
  const { data } = await client.post<{ access_token: string }>("/api/auth/token", {
    username,
    password,
  });
  return data.access_token;
}
