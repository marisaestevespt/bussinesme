import { CalendarDays, CalendarRange, ArrowDownLeft, ArrowUpRight, Receipt, Shield, FolderOpen, Truck, Package, CalendarCheck, LineChart, type LucideIcon } from 'lucide-react';
import { getPlanningSection } from '@/lib/department-planning';

export interface SectionDef {
  path: string;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  color: string;
  key: string;
}

export const ALL_SECTIONS_ROW1: SectionDef[] = [
  // Planeamento sempre primeiro (regra: ver mem://design/department-planning-card.md)
  (() => { const p = getPlanningSection('financeiro'); return { path: p.path, label: p.label, icon: p.icon, iconColor: p.iconColor, color: p.color, key: p.key }; })(),
  { path: '/hub/financeiro/mensal', label: 'Mensal', icon: CalendarDays, iconColor: 'text-info', color: 'from-info/20 to-info/10 border-info/30/60 hover:from-info/30 hover:to-info/15 hover:border-info/30/80', key: 'mensal' },
  { path: '/hub/financeiro/trimestral', label: 'Trimestral', icon: CalendarRange, iconColor: 'text-accent-violet', color: 'from-accent-violet/20 to-accent-violet/10 border-accent-violet/60 hover:from-accent-violet/30 hover:to-accent-violet/15 hover:border-accent-violet/80', key: 'trimestral' },
  { path: '/hub/financeiro/documentos', label: 'Documentos', icon: FolderOpen, iconColor: 'text-warning', color: 'from-warning/20 to-warning/10 border-warning/30/60 hover:from-warning/30 hover:to-warning/15 hover:border-warning/30/80', key: 'documentos' },
  { path: '/hub/financeiro/entradas', label: 'Entradas', icon: ArrowDownLeft, iconColor: 'text-success', color: 'from-success/20 to-success/10 border-success/30/60 hover:from-success/30 hover:to-success/15 hover:border-success/30/80', key: 'entradas' },
  { path: '/hub/financeiro/saidas', label: 'Saídas', icon: ArrowUpRight, iconColor: 'text-destructive', color: 'from-destructive/20 to-destructive/10 border-destructive/30/60 hover:from-destructive/30 hover:to-destructive/15 hover:border-destructive/30/80', key: 'saidas' },
];

export const ALL_SECTIONS_ROW2: SectionDef[] = [
  { path: '/hub/financeiro/iva', label: 'IVA', icon: Receipt, iconColor: 'text-warning', color: 'from-warning/20 to-warning/10 border-warning/30/60 hover:from-warning/30 hover:to-warning/15 hover:border-warning/30/80', key: 'iva' },
  { path: '/hub/financeiro/seguranca-social', label: 'Segurança Social', icon: Shield, iconColor: 'text-info', color: 'from-info/20 to-info/10 border-info/60 hover:from-info/30 hover:to-info/15 hover:border-info/80', key: 'ss' },
  { path: '/hub/financeiro/contabilidade', label: 'Prazos Fiscais', icon: CalendarCheck, iconColor: 'text-success', color: 'from-success/20 to-success/10 border-success/30/60 hover:from-success/30 hover:to-success/15 hover:border-success/30/80', key: 'contabilidade' },
  { path: '/hub/financeiro/setup-financeiro', label: 'Lista de Fornecedores', icon: Truck, iconColor: 'text-muted-foreground', color: 'from-border/20 to-border/10 border-border/60 hover:from-border/30 hover:to-border/15 hover:border-border/80', key: 'fornecedores' },
  { path: '/hub/financeiro/lista-produtos', label: 'Lista de Produtos', icon: Package, iconColor: 'text-info', color: 'from-info/20 to-info/10 border-info/60 hover:from-info/30 hover:to-info/15 hover:border-info/80', key: 'produtos' },
  { path: '/hub/financeiro/previsibilidade', label: 'Previsibilidade', icon: LineChart, iconColor: 'text-primary', color: 'from-primary/20 to-primary/10 border-primary/60 hover:from-primary/30 hover:to-primary/15 hover:border-primary/80', key: 'previsibilidade' },
];

export const PIE_COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#6366f1'];

export const ML = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];