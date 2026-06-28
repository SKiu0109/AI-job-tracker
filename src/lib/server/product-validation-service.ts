import "server-only";

import type {
  FeedbackPayload,
  ProductEventPayload
} from "@/types/product-validation";
import { getSupabaseServerConfig } from "@/lib/server/supabase-config";

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
  recordEvent(guestId: string, event: ProductEventPayload): Promise<void>;
  createFeedback(
    guestId: string,
    feedback: FeedbackPayload
  ): Promise<StoredFeedback>;
}

class InMemoryProductValidationService implements ProductValidationService {
  constructor(
    private readonly events: StoredProductEvent[],
    private readonly feedback: StoredFeedback[]
  ) {}

  async recordEvent(guestId: string, event: ProductEventPayload) {
    const storedEvent: StoredProductEvent = {
      ...event,
      guestId,
      receivedAt: new Date().toISOString()
    };

    this.events.push(storedEvent);
    trimToLimit(this.events, 500);
    console.info("[product-event]", storedEvent);
  }

  async createFeedback(guestId: string, feedback: FeedbackPayload) {
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

class SupabaseProductValidationService implements ProductValidationService {
  private readonly restUrl: string;

  constructor(
    supabaseUrl: string,
    private readonly serviceRoleKey: string
  ) {
    this.restUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1`;
  }

  async recordEvent(guestId: string, event: ProductEventPayload) {
    await this.insert("product_events", {
      guest_id: guestId,
      event_name: event.eventName,
      path: event.path,
      language: event.language,
      occurred_at: event.occurredAt,
      received_at: new Date().toISOString(),
      properties: event.properties ?? {}
    });
  }

  async createFeedback(guestId: string, feedback: FeedbackPayload) {
    const createdAt = new Date().toISOString();
    const rows = await this.insert(
      "feedback",
      {
        guest_id: guestId,
        role: feedback.role,
        goal: feedback.goal,
        feedback: feedback.feedback,
        email: feedback.email ?? null,
        rating: feedback.rating ?? null,
        language: feedback.language,
        path: feedback.path,
        created_at: createdAt
      },
      true
    );
    const id =
      Array.isArray(rows) && rows[0]?.id ? String(rows[0].id) : crypto.randomUUID();

    return {
      ...feedback,
      id,
      guestId,
      createdAt
    };
  }

  private async insert(
    tableName: "product_events" | "feedback",
    body: Record<string, unknown>,
    returnRepresentation = false
  ) {
    const response = await fetch(`${this.restUrl}/${tableName}`, {
      method: "POST",
      headers: {
        apikey: this.serviceRoleKey,
        authorization: `Bearer ${this.serviceRoleKey}`,
        "content-type": "application/json",
        prefer: returnRepresentation ? "return=representation" : "return=minimal"
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => "");
      throw new Error(
        `Supabase ${tableName} insert failed: ${response.status} ${errorText}`
      );
    }

    return returnRepresentation ? response.json() : null;
  }
}

class FallbackProductValidationService implements ProductValidationService {
  constructor(
    private readonly primary: ProductValidationService,
    private readonly fallback: ProductValidationService
  ) {}

  async recordEvent(guestId: string, event: ProductEventPayload) {
    try {
      await this.primary.recordEvent(guestId, event);
    } catch (error) {
      console.warn("[product-event-fallback]", error);
      await this.fallback.recordEvent(guestId, event);
    }
  }

  async createFeedback(guestId: string, feedback: FeedbackPayload) {
    try {
      return await this.primary.createFeedback(guestId, feedback);
    } catch (error) {
      console.warn("[product-feedback-fallback]", error);
      return this.fallback.createFeedback(guestId, feedback);
    }
  }
}

const globalForProductValidation = globalThis as typeof globalThis & {
  __aiJobTrackerProductEvents?: StoredProductEvent[];
  __aiJobTrackerFeedback?: StoredFeedback[];
};

export function getProductValidationService(): ProductValidationService {
  const events = globalForProductValidation.__aiJobTrackerProductEvents ?? [];
  const feedback = globalForProductValidation.__aiJobTrackerFeedback ?? [];

  globalForProductValidation.__aiJobTrackerProductEvents = events;
  globalForProductValidation.__aiJobTrackerFeedback = feedback;

  const memoryService = new InMemoryProductValidationService(events, feedback);
  const { supabaseUrl, serviceRoleKey } = getSupabaseServerConfig();

  if (supabaseUrl && serviceRoleKey) {
    return new FallbackProductValidationService(
      new SupabaseProductValidationService(supabaseUrl, serviceRoleKey),
      memoryService
    );
  }

  return memoryService;
}

function trimToLimit<T>(items: T[], limit: number) {
  if (items.length > limit) {
    items.splice(0, items.length - limit);
  }
}
