import type { FinDocItem } from '../FinDocumentsUpload';

export interface SSContract {
  id: string;
  member_id: string;
  monthly_value: number | null;
  team_members?: { id: string; full_name: string } | null;
}

export interface SSPayrollEntry {
  id?: string;
  collaborator_name?: string;
  month: number;
  year: number;
  gross_salary?: number | null;
}

export interface IndependenteRow {
  month: number;
  quarterRevenue: number;
  rendimentoRelevante: number;
  baseIncidencia: number;
  contribution: number;
  paid: number;
  isPaid: boolean;
  hasData: boolean;
  srcLabel: string;
  declMonth: string;
  declYear: number;
}

export interface PatronalRow {
  month: number;
  totalGross: number;
  ssEmployer: number;
  ssEmployee: number;
  totalSS: number;
  paid: number;
  isPaid: boolean;
}

export type { FinDocItem };

export type SSPaymentType = 'independente' | 'patronal';

export const SS_MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
