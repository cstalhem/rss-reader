"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDownloadStatus, API_BASE_URL } from "@/lib/api";
import { DownloadStatus } from "@/lib/types";
import { queryKeys } from "@/lib/queryKeys";

const DOWNLOAD_STATUS_POLL_INTERVAL = 1_000;
const SCORE_100_PERCENT_DELAY = 500;

export interface PullProgress {
  status: string;
  completed: number;
  total: number;
  percentage: number;
  speed: string;
}

interface SpeedSample {
  time: number;
  bytes: number;
}

function formatSpeed(bytesPerSecond: number): string {
  if (bytesPerSecond >= 1024 * 1024) {
    return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`;
  }
  return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
}

function calcSpeed(samples: SpeedSample[]): string {
  if (samples.length < 2) return "";
  const first = samples[0];
  const last = samples[samples.length - 1];
  const elapsed = (last.time - first.time) / 1000;
  if (elapsed <= 0) return "";
  const bytes = last.bytes - first.bytes;
  return formatSpeed(bytes / elapsed);
}

export function useModelPull() {
  const [progress, setProgress] = useState<PullProgress | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [intervalMs, setIntervalMs] = useState<number | false>(false);
  const abortRef = useRef<AbortController | null>(null);
  const samplesRef = useRef<SpeedSample[]>([]);
  const queryClient = useQueryClient();

  // Navigate-away resilience: poll download status on mount
  const { data: downloadStatus } = useQuery<DownloadStatus>({
    queryKey: queryKeys.ollama.downloadStatus,
    queryFn: fetchDownloadStatus,
    refetchInterval: intervalMs,
    // Only poll when we think a download is active but we lost the SSE stream
    // (i.e., user navigated away and came back)
  });

  // On mount, check if a download is already active (navigate-away recovery)
  useEffect(() => {
    if (!downloadStatus) return;

    if (downloadStatus.active && !abortRef.current) {
      // There's an active download but we don't have an SSE stream — poll mode
      setIsDownloading(true);
      setIntervalMs(DOWNLOAD_STATUS_POLL_INTERVAL); // Start polling
      const pct =
        downloadStatus.total > 0
          ? Math.round((downloadStatus.completed / downloadStatus.total) * 100)
          : 0;
      setProgress({
        status: downloadStatus.status ?? "downloading",
        completed: downloadStatus.completed,
        total: downloadStatus.total,
        percentage: pct,
        speed: "",
      });
    } else if (!downloadStatus.active && isDownloading && !abortRef.current) {
      // Download finished while we were polling
      setIsDownloading(false);
      setIntervalMs(false); // Stop polling
      setProgress(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.ollama.models });
    }
  }, [downloadStatus, isDownloading, queryClient]);

  const startPull = useCallback(
    async (model: string) => {
      setError(null);
      setIsDownloading(true);
      setIntervalMs(DOWNLOAD_STATUS_POLL_INTERVAL);
      setProgress({
        status: "starting",
        completed: 0,
        total: 0,
        percentage: 0,
        speed: "",
      });
      samplesRef.current = [];

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/ollama/downloads`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model }),
            signal: controller.signal,
          }
        );

        if (!response.ok) {
          throw new Error(
            `Pull failed: ${response.status} ${response.statusText}`
          );
        }

        const reader = response.body!.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));

                // Check for error field
                if (data.error) {
                  setError(data.error);
                  setIsDownloading(false);
                  setProgress(null);
                  abortRef.current = null;
                  return;
                }

                const completed = data.completed ?? 0;
                const total = data.total ?? 0;
                const pct =
                  total > 0 ? Math.round((completed / total) * 100) : 0;

                // Track speed samples (rolling 2s window)
                const now = Date.now();
                samplesRef.current.push({ time: now, bytes: completed });
                samplesRef.current = samplesRef.current.filter(
                  (s) => now - s.time < 2000
                );

                setProgress({
                  status: data.status ?? "downloading",
                  completed,
                  total,
                  percentage: pct,
                  speed: calcSpeed(samplesRef.current),
                });
              } catch {
                // Skip malformed JSON lines
              }
            }
          }
        }

        // Stream ended successfully
        abortRef.current = null;
        // Show 100% briefly before clearing
        setProgress((prev) =>
          prev ? { ...prev, percentage: 100, status: "complete" } : null
        );
        setTimeout(() => {
          setIsDownloading(false);
          setIntervalMs(false);
          setProgress(null);
          queryClient.invalidateQueries({ queryKey: queryKeys.ollama.models });
        }, SCORE_100_PERCENT_DELAY);
      } catch (err: unknown) {
        abortRef.current = null;
        if (err instanceof DOMException && err.name === "AbortError") {
          // User cancelled — not an error
          setIsDownloading(false);
          setIntervalMs(false); // Stop polling
          setProgress(null);
          return;
        }
        const message =
          err instanceof Error ? err.message : "Download failed";
        setError(message);
        setIsDownloading(false);
        setIntervalMs(false); // Stop polling
        setProgress(null);
      }
    },
    [queryClient]
  );

  const cancelPull = useCallback(async () => {
    // Abort the SSE stream
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Safety net: also tell the backend to cancel
    try {
      await fetch(`${API_BASE_URL}/api/ollama/downloads`, {
        method: "DELETE",
      });
    } catch {
      // Best effort
    }

    setIsDownloading(false);
    setIntervalMs(false); // Stop polling
    setProgress(null);
    setError(null);
  }, []);

  return { progress, isDownloading, error, startPull, cancelPull };
}
