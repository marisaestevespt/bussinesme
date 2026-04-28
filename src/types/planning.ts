/**
 * Shared types for the Planning module (`usePlanningData`).
 *
 * Derived from Supabase row types where possible, with permissive
 * extensions for fields that are populated dynamically (e.g. `actual_value`
 * computed in JS, `product_name` resolved on-the-fly).
 */
import type { Tables } from '@/integrations/supabase/types';

export type ObjectiveRow = Tables<'executive_objectives'>;
export type CriterionRow = Tables<'objective_criteria'>;
export type GoalRow = Tables<'planning_goals'>;
export type MetricRow = Tables<'objective_metrics'>;
export type MetricHistoryRow = Tables<'metric_history'>;
export type ActionRow = Tables<'objective_actions'>;

/**
 * Loose form payload accepted by the upsert mutations. The forms can submit
 * partial records (id missing for inserts), and `cleanPayload` strips empty
 * strings before hitting the DB.
 */
export type PlanningFormPayload = Record<string, unknown> & { id?: string };

/** Sales row used by autoSalesRaw / goalAutoValue */
export interface AutoSalesRow {
  invoice_total: number | null;
  product: string | null;
  product_id: string | null;
  sale_month: number | null;
}

/** CRM lead row used by autoCrmRaw / goalAutoValue */
export interface AutoCrmRow {
  id: string;
  potential_product: string | null;
  potential_product_id: string | null;
  created_at: string | null;
}

export interface AutoTimeEntryRow {
  duration: number | null;
  entry_month: number | null;
  category: string | null;
  client_id: string | null;
}

export interface AutoTaskRow {
  id: string;
  updated_at: string | null;
  department: string | null;
}

export interface AutoMarketingFollowersRow {
  followers: number | null;
  channel_id: string | null;
  month: number | null;
}

export interface AutoContentItemRow {
  id: string;
  product_id: string | null;
  scheduled_at: string | null;
}

export interface AutoContentChannelRow {
  content_id: string;
  channel_id: string;
}

export interface AutoMeetingRow {
  id: string;
  department: string | null;
  client_id: string | null;
  date_time: string | null;
}

export interface AutoNpsRow {
  nps_score: number | null;
  client_id: string | null;
  actual_date: string | null;
}

export interface AutoExpenseRow {
  total_with_vat: number | null;
  category: string | null;
  expense_date: string | null;
}

export interface AutoProjectRow {
  id: string;
  type: string | null;
  client_name: string | null;
  updated_at: string | null;
}

export interface ProductLite {
  id: string;
  name: string;
}