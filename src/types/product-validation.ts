export type ProductEventName =
  | "demo_sample_loaded"
  | "analyze_jd_clicked"
  | "csv_exported"
  | "guest_data_imported_to_account"
  | "import_draft_analyzed"
  | "job_detail_opened"
  | "job_added"
  | "cloud_sync_failed_visible"
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

export type FeedbackSubmissionPayload = {
  areaLabel: string;
  email?: string;
  evidence: string;
  expectedChange: string;
  feedbackTypeLabel: string;
  goal: string;
  language: "en" | "zh";
  path: string;
  priorityLabel: string;
  rating: number;
  role: string;
};

export type FeedbackResponse = {
  ok: boolean;
  feedbackId?: string;
  error?: string;
};

export type AdminFeedbackItem = FeedbackPayload & {
  id: string;
  guestId: string;
  createdAt: string;
};

export type AdminFeedbackListResponse = {
  feedback: AdminFeedbackItem[];
  stats: {
    averageRating: number | null;
    total: number;
    withEmail: number;
    zhCount: number;
  };
};
