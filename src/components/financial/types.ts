/**
 * Shared types for the Financeiro / Contabilidade module.
 *
 * Used to replace inline `any` in expense forms, business setup, suppliers
 * and report builders (Fase 2 da auditoria).
 */

import type { Tables } from '@/integrations/supabase/types';
import type { DocEntry } from './InvoiceUpload';

/* ─── Expenses ───────────────────────────────────────────────── */

export type ExpenseRow = Tables<'financial_expenses'>;
export type SupplierRow = Tables<'suppliers'>;
export type SaleRow = Tables<'commercial_sales'>;
export type FinancialDocumentRow = Tables<'financial_documents'>;
export type PayrollRow = Tables<'financial_payroll'>;
export type ContractorRow = Tables<'financial_contractors'>;
export type ClientRow = Tables<'clients'>;
export type FinancialGoalRow = Tables<'financial_goals'>;

/**
 * Editable form state for the expense dialog (FinSaidas, ExpenseDetailSheet,
 * FinSetupFinanceiro, finMensal/SaidasSection).
 * All fields are optional / loose because the form is partially filled.
 */
export interface ExpenseFormState {
  id?: string;
  status?: string;
  expense_date?: string | Date | null;
  description?: string;
  category?: string;
  department?: string;
  base_value?: string | number;
  vat_rate?: number | string;
  location?: string;
  payment_method?: string;
  supplier_id?: string | null;
  includes_vat?: boolean;
  is_recurring?: boolean;
  periodicity?: string;
  recurrence_day?: number | null;
  monthly_equivalent?: number;
  expense_name?: string;
  documents?: DocEntry[];
  meta_ads_docs?: DocEntry[];
  source_type?: string | null;
  source_id?: string | null;
}

/* ─── Business setup / Settings ──────────────────────────────── */

export interface PaymentMethodEntry {
  type?: string;
  label?: string;
  value?: string;
  card_last4?: string;
  card_expiry?: string;
  [key: string]: unknown;
}

export interface BusinessSettingsLike {
  business_name?: string;
  business_legal_name?: string;
  iva_exempt?: boolean;
  [key: string]: unknown;
}

/* ─── Suppliers ──────────────────────────────────────────────── */

export interface SupplierSelectOption {
  id: string;
  name: string;
  default_vat_rate?: number | null;
  payment_method?: string | null;
  category?: string | null;
  nif?: string | null;
  phone?: string | null;
  email?: string | null;
  iban?: string | null;
  address?: string | null;
  website?: string | null;
  notes?: string | null;
}

export interface SupplierFormState {
  name?: string;
  nif?: string;
  phone?: string;
  email?: string;
  iban?: string;
  payment_method?: string;
  default_vat_rate?: number;
  address?: string;
  website?: string;
  notes?: string;
}

/* ─── Contracts (FinSegurancaSocial) ─────────────────────────── */

export interface ContractWithMember {
  id: string;
  member_id?: string | null;
  monthly_value?: number | null;
  payment_day?: number | null;
  contract_type?: string | null;
  team_members?: { full_name?: string | null } | null;
}