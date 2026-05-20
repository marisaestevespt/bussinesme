import { Target, type LucideIcon } from 'lucide-react';
import type { DepartmentKey } from '@/components/shared/DepartmentLinks';

/**
 * Departments that have a dedicated planning page at /planeamento/dep/:department.
 * Source-of-truth for surfacing the "Planeamento" card in the main grid of each
 * department dashboard. NEVER duplicate this list — import it.
 */
export const PLANNING_DEPTS: DepartmentKey[] = [
  'comercial', 'marketing', 'financeiro', 'operacao', 'clientes', 'produtos', 'equipa',
];

export interface PlanningCardDef {
  path: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  iconColor: string;
  color: string;
  key: 'planeamento';
}

/**
 * Returns a section/card descriptor for the department planning page,
 * compatible with the card grids used in Comercial, Marketing, Financeiro,
 * Operacao, Clientes, Produtos, Equipa dashboards.
 */
export function getPlanningSection(department: DepartmentKey): PlanningCardDef {
  return {
    path: `/planeamento/dep/${department}`,
    label: 'Planeamento & Análise',
    desc: 'Objetivos, KPRs e análise mensal',
    icon: Target,
    iconColor: 'text-primary',
    color: 'from-primary/15 to-primary/5 border-primary/30 hover:from-primary/25 hover:to-primary/10 hover:border-primary/50',
    key: 'planeamento',
  };
}

export function hasPlanning(department: DepartmentKey | undefined): boolean {
  return !!department && PLANNING_DEPTS.includes(department);
}
