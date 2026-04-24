import { CalendarDays, CalendarRange, ArrowDownLeft, ArrowUpRight, Receipt, Shield, FolderOpen, Truck, Package, CalendarCheck, type LucideIcon } from 'lucide-react';

export interface SectionDef {
  path: string;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  color: string;
  key: string;
}

export const ALL_SECTIONS_ROW1: SectionDef[] = [
  { path: '/hub/financeiro/mensal', label: 'Mensal', icon: CalendarDays, iconColor: 'text-info', color: 'from-blue-500/20 to-blue-600/10 border-info/30/60 hover:from-blue-500/30 hover:to-blue-600/15 hover:border-info/30/80', key: 'mensal' },
  { path: '/hub/financeiro/trimestral', label: 'Trimestral', icon: CalendarRange, iconColor: 'text-violet-600', color: 'from-violet-500/20 to-violet-600/10 border-violet-200/60 hover:from-violet-500/30 hover:to-violet-600/15 hover:border-violet-300/80', key: 'trimestral' },
  { path: '/hub/financeiro/documentos', label: 'Documentos', icon: FolderOpen, iconColor: 'text-warning', color: 'from-orange-500/20 to-orange-600/10 border-warning/30/60 hover:from-orange-500/30 hover:to-orange-600/15 hover:border-warning/30/80', key: 'documentos' },
  { path: '/hub/financeiro/entradas', label: 'Entradas', icon: ArrowDownLeft, iconColor: 'text-success', color: 'from-emerald-500/20 to-emerald-600/10 border-success/30/60 hover:from-emerald-500/30 hover:to-emerald-600/15 hover:border-success/30/80', key: 'entradas' },
  { path: '/hub/financeiro/saidas', label: 'Saídas', icon: ArrowUpRight, iconColor: 'text-destructive', color: 'from-red-500/20 to-red-600/10 border-destructive/30/60 hover:from-red-500/30 hover:to-red-600/15 hover:border-destructive/30/80', key: 'saidas' },
];

export const ALL_SECTIONS_ROW2: SectionDef[] = [
  { path: '/hub/financeiro/iva', label: 'IVA', icon: Receipt, iconColor: 'text-warning', color: 'from-amber-500/20 to-amber-600/10 border-warning/30/60 hover:from-amber-500/30 hover:to-amber-600/15 hover:border-warning/30/80', key: 'iva' },
  { path: '/hub/financeiro/seguranca-social', label: 'Segurança Social', icon: Shield, iconColor: 'text-cyan-600', color: 'from-cyan-500/20 to-cyan-600/10 border-cyan-200/60 hover:from-cyan-500/30 hover:to-cyan-600/15 hover:border-cyan-300/80', key: 'ss' },
  { path: '/hub/financeiro/contabilidade', label: 'Prazos Fiscais', icon: CalendarCheck, iconColor: 'text-success', color: 'from-emerald-500/20 to-emerald-600/10 border-success/30/60 hover:from-emerald-500/30 hover:to-emerald-600/15 hover:border-success/30/80', key: 'contabilidade' },
  { path: '/hub/financeiro/setup-financeiro', label: 'Lista de Fornecedores', icon: Truck, iconColor: 'text-slate-600', color: 'from-slate-500/20 to-slate-600/10 border-slate-200/60 hover:from-slate-500/30 hover:to-slate-600/15 hover:border-slate-300/80', key: 'fornecedores' },
  { path: '/hub/financeiro/lista-produtos', label: 'Lista de Produtos', icon: Package, iconColor: 'text-indigo-600', color: 'from-indigo-500/20 to-indigo-600/10 border-indigo-200/60 hover:from-indigo-500/30 hover:to-indigo-600/15 hover:border-indigo-300/80', key: 'produtos' },
];

export const PIE_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];

export const ML = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];