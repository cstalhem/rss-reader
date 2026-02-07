"use client";

import { useEffect, useRef } from "react";
import { useMarkAsRead } from "./useArticles";

/**
 * Auto-marks an article as read after ~12 seconds of viewing.
 * Timer cleans up on unmount or when articleId changes.
 */
export function useAutoMarkAsRead(articleId: number, isRead: boolean) {
  const { mutate: markAsRead } = useMarkAsRead();
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    // Skip if already read
    if (isRead) {
      return;
    }

    // Start 12-second timer to mark as read
    timerRef.current = setTimeout(() => {
      markAsRead({ articleId, isRead: true });
    }, 12000);

    // Cleanup on unmount or when articleId/isRead changes
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [articleId, isRead, markAsRead]);
}
