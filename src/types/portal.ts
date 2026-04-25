// Shared types for the client portal entities. These mirror the loosely-typed
// shapes returned by Supabase RPCs (`get_portal_*`) and JSON columns. They are
// intentionally permissive (most fields optional) but eliminate raw `any` in
// callbacks (sort/map/filter) inside PortalView and related components.

export interface PortalFaq {
  id: string;
  question?: string | null;
  answer?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
}

export interface PortalQuestion {
  id: string;
  question?: string | null;
  answer?: string | null;
  file_urls?: string[] | null;
  sort_order?: number | null;
  created_at?: string | null;
  section?: string | null;
  question_group?: string | null;
  group_sort_order?: number | null;
  [k: string]: unknown;
}

export interface PortalComment {
  id: string;
  content?: string | null;
  author?: string | null;
  created_at?: string | null;
}

export interface PortalFeedback {
  id: string;
  content?: string | null;
  rating?: number | null;
  submitted_at?: string | null;
  created_at?: string | null;
}

export interface PortalMeetingDoc {
  url?: string;
  title?: string;
  [k: string]: unknown;
}

export type PortalMeetingPoint = string | { text?: string; action?: string; [k: string]: unknown };

export interface PortalMeeting {
  id: string;
  title?: string | null;
  date_time?: string | null;
  status?: string | null;
  meeting_type?: string | null;
  discussion_points?: PortalMeetingPoint[] | null;
  priorities?: PortalMeetingPoint[] | null;
  documents?: PortalMeetingDoc[] | null;
  notes?: string | null;
  [k: string]: unknown;
}

export interface PortalPayment {
  id: string;
  amount?: number | null;
  payment_date?: string | null;
  status?: string | null;
  description?: string | null;
  [k: string]: unknown;
}

export interface PortalDeliverable {
  id: string;
  title?: string | null;
  status?: string | null;
  name?: string | null;
  phase_name?: string | null;
  planned_end?: string | null;
  [k: string]: unknown;
}

export interface PortalPhase {
  id: string;
  name?: string | null;
  title?: string | null;
  status?: string | null;
  deliverables?: PortalDeliverable[] | null;
  [k: string]: unknown;
}

export interface PortalMaterial {
  id: string;
  file_name?: string | null;
  file_url?: string | null;
  created_at?: string | null;
  [k: string]: unknown;
}

export interface PortalContractDocument {
  id: string;
  title?: string | null;
  file_url?: string | null;
  created_at?: string | null;
  [k: string]: unknown;
}

export interface PortalProjectHistoryEntry {
  id: string;
  type?: string | null;
  title?: string | null;
  description?: string | null;
  date?: string | null;
  created_at?: string | null;
  [k: string]: unknown;
}