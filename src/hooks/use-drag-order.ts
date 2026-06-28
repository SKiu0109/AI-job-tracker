"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TOUCH_LONG_PRESS_MS } from "@/lib/constants";

/** Manage draggable item order with localStorage persistence. */
export function useDragOrder<T extends string>(
  storageKey: string,
  defaults: T[]
) {
  const [items, setItems] = useState<T[]>(() => {
    if (typeof window === "undefined") return defaults;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return defaults;
      const parsed: T[] = JSON.parse(raw);
      // Keep only keys that exist in defaults (drop stale entries)
      const filtered = parsed.filter((k) => defaults.includes(k));
      // Append any missing defaults at the end
      const merged = [...filtered, ...defaults.filter((k) => !filtered.includes(k))];
      return merged.length === defaults.length ? merged : defaults;
    } catch {
      return defaults;
    }
  });

  const [activeId, setActiveId] = useState<T | null>(null);
  const dragItem = useRef<T | null>(null);
  const dragOverItem = useRef<T | null>(null);

  const persist = useCallback(
    (order: T[]) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(order));
      } catch {
        // storage full or unavailable — silently ignore
      }
    },
    [storageKey]
  );

  // Reset to defaults
  const reset = useCallback(() => {
    setItems(defaults);
    persist(defaults);
  }, [defaults, persist]);

  const onDragStart = useCallback((id: T) => {
    dragItem.current = id;
    setActiveId(id);
  }, []);

  const onDragEnter = useCallback((id: T) => {
    dragOverItem.current = id;
  }, []);

  const onDragEnd = useCallback(() => {
    const from = items.indexOf(dragItem.current as T);
    const to = items.indexOf(dragOverItem.current as T);

    if (from === -1 || to === -1 || from === to) {
      setActiveId(null);
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    setItems(next);
    persist(next);
    setActiveId(null);
    dragItem.current = null;
    dragOverItem.current = null;
  }, [items, persist]);

  // Touch support — long-press to initiate drag
  const touchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchTarget = useRef<HTMLElement | null>(null);

  const onTouchStart = useCallback(
    (id: T, el: HTMLElement) => {
      touchTarget.current = el;
      touchTimer.current = setTimeout(() => {
        el.draggable = true;
        // Dispatch a fake dragstart
        const ev = new DragEvent("dragstart", { bubbles: true });
        el.dispatchEvent(ev);
      }, TOUCH_LONG_PRESS_MS); // 400ms long-press threshold
    },
    []
  );

  const onTouchEnd = useCallback(() => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
      touchTimer.current = null;
    }
    if (touchTarget.current) {
      touchTarget.current.draggable = false;
      touchTarget.current = null;
    }
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      if (touchTimer.current) clearTimeout(touchTimer.current);
    };
  }, []);

  return {
    items,
    activeId,
    onDragStart,
    onDragEnter,
    onDragEnd,
    onTouchStart,
    onTouchEnd,
    reset,
  };
}
