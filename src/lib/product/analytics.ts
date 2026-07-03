import type {
  ProductEventName,
  ProductEventPayload
} from "@/types/product-validation";
import { MAX_LOCAL_EVENT_QUEUE } from "@/lib/constants";

const LOCAL_EVENT_QUEUE_KEY = "ai-bilingual-job-tracker.product-events.v1";

export function trackProductEvent(
  eventName: ProductEventName,
  properties: ProductEventPayload["properties"] = {}
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: ProductEventPayload = {
    eventName,
    properties,
    path: window.location.pathname,
    language: document.documentElement.lang || "en",
    occurredAt: new Date().toISOString()
  };

  window
    .fetch("/api/product-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true
    })
    .catch(() => queueLocalEvent(payload));
}

function queueLocalEvent(payload: ProductEventPayload) {
  try {
    const existing = window.localStorage.getItem(LOCAL_EVENT_QUEUE_KEY);
    const events = existing ? (JSON.parse(existing) as ProductEventPayload[]) : [];
    events.push(payload);
    window.localStorage.setItem(
      LOCAL_EVENT_QUEUE_KEY,
      JSON.stringify(events.slice(-MAX_LOCAL_EVENT_QUEUE))
    );
  } catch {
    // Analytics should never block the product flow.
  }
}
