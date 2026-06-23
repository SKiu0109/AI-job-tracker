import "server-only";

import type {
  FeedbackPayload,
  ProductEventPayload
} from "@/types/product-validation";

type StoredProductEvent = ProductEventPayload & {
  guestId: string;
  receivedAt: string;
};

type StoredFeedback = FeedbackPayload & {
  id: string;
  guestId: string;
  createdAt: string;
};

export interface ProductValidationService {
  recordEvent(guestId: string, event: ProductEventPayload): void;
  createFeedback(guestId: string, feedback: FeedbackPayload): StoredFeedback;
}

class InMemoryProductValidationService implements ProductValidationService {
  constructor(
    private readonly events: StoredProductEvent[],
    private readonly feedback: StoredFeedback[]
  ) {}

  recordEvent(guestId: string, event: ProductEventPayload) {
    const storedEvent: StoredProductEvent = {
      ...event,
      guestId,
      receivedAt: new Date().toISOString()
    };

    this.events.push(storedEvent);
    trimToLimit(this.events, 500);
    console.info("[product-event]", storedEvent);
  }

  createFeedback(guestId: string, feedback: FeedbackPayload) {
    const storedFeedback: StoredFeedback = {
      ...feedback,
      id: crypto.randomUUID(),
      guestId,
      createdAt: new Date().toISOString()
    };

    this.feedback.push(storedFeedback);
    trimToLimit(this.feedback, 200);
    console.info("[product-feedback]", storedFeedback);

    return storedFeedback;
  }
}

const globalForProductValidation = globalThis as typeof globalThis & {
  __aiJobTrackerProductEvents?: StoredProductEvent[];
  __aiJobTrackerFeedback?: StoredFeedback[];
};

export function getProductValidationService(): ProductValidationService {
  // TODO: Replace this in-memory validation store with Supabase tables for
  // product_events and feedback before relying on this for product decisions.
  const events = globalForProductValidation.__aiJobTrackerProductEvents ?? [];
  const feedback = globalForProductValidation.__aiJobTrackerFeedback ?? [];

  globalForProductValidation.__aiJobTrackerProductEvents = events;
  globalForProductValidation.__aiJobTrackerFeedback = feedback;

  return new InMemoryProductValidationService(events, feedback);
}

function trimToLimit<T>(items: T[], limit: number) {
  if (items.length > limit) {
    items.splice(0, items.length - limit);
  }
}
