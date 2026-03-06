import { API_BASE_URL, throwApiError } from "@/lib/api";
import type {
  DownloadStatus,
  OllamaConfig,
  OllamaHealth,
  OllamaModel,
  OllamaPrompts,
} from "@/lib/types";

export async function testOllamaConnection(
  baseUrl: string,
  port: number
): Promise<OllamaHealth> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/test-connection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ base_url: baseUrl, port }),
  });

  if (!response.ok) {
    await throwApiError(response, "Failed to test connection");
  }

  return response.json();
}

export async function fetchOllamaHealth(): Promise<OllamaHealth> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/health`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch Ollama health");
  }

  return response.json();
}

export async function fetchOllamaModels(): Promise<OllamaModel[]> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/models`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch Ollama models");
  }

  return response.json();
}

export async function fetchOllamaConfig(): Promise<OllamaConfig> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/config`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch Ollama config");
  }

  return response.json();
}

export async function fetchOllamaPrompts(): Promise<OllamaPrompts> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/prompts`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch Ollama prompts");
  }

  return response.json();
}

export async function deleteOllamaModel(name: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/api/ollama/models/${encodeURIComponent(name)}`,
    {
      method: "DELETE",
    }
  );

  if (!response.ok) {
    await throwApiError(response, "Failed to delete Ollama model");
  }
}

export async function fetchDownloadStatus(): Promise<DownloadStatus> {
  const response = await fetch(`${API_BASE_URL}/api/ollama/downloads`);

  if (!response.ok) {
    await throwApiError(response, "Failed to fetch download status");
  }

  return response.json();
}
