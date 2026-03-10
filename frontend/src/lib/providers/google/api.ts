import { API_BASE_URL, throwApiError } from "@/lib/api";
import type {
  GoogleConfig,
  GoogleModelItem,
  TestKeyResponse,
} from "@/lib/types";

export async function fetchGoogleConfig(): Promise<GoogleConfig> {
  const response = await fetch(`${API_BASE_URL}/api/google/config`);
  if (!response.ok) await throwApiError(response, "Failed to fetch Google config");
  return response.json();
}

export async function testGoogleKey(apiKey: string): Promise<TestKeyResponse> {
  const response = await fetch(`${API_BASE_URL}/api/google/test-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!response.ok) await throwApiError(response, "Failed to test Google API key");
  return response.json();
}

export async function fetchGoogleAvailableModels(): Promise<GoogleModelItem[]> {
  const response = await fetch(`${API_BASE_URL}/api/google/models/available`);
  if (!response.ok) await throwApiError(response, "Failed to fetch Google models");
  return response.json();
}

