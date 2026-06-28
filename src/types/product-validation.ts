export type ProductEventName =
  | "demo_sample_loaded"
  | "analyze_jd_clicked"
  | "csv_exported"
  | "job_detail_opened"
  | "job_added"
  | "feedback_opened"
  | "feedback_submitted";

export type ProductEventPayload = {
  eventName: ProductEventName;
  path: string;
  language: string;
  occurredAt: string;
  properties?: Record<string, string | number | boolean | null>;
};

export type FeedbackPayload = {
  role: string;
  goal: string;
  feedback: string;
  email?: string;
  rating?: number;
  language: string;
  path: string;
};

export type FeedbackResponse = {
  ok: boolean;
  feedbackId?: string;
  error?: string;
};
