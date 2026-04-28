// Shared department constants used across sidebar, processos, and other pages

export const DEPARTMENTS = [
  { value: 'admin',            label: 'Administração',     gradient: 'from-warning to-warning',                  icon: '👑', lucideIcon: 'Crown',       badgeColor: 'bg-warning/15 text-warning border-warning/30' },
  { value: 'marketing',        label: 'Marketing',         gradient: 'from-accent-violet to-destructive',        icon: '📣', lucideIcon: 'Megaphone',   badgeColor: 'bg-accent-violet/15 text-accent-violet border-accent-violet/30' },
  { value: 'comercial',        label: 'Comercial',         gradient: 'from-warning to-warning',                  icon: '🤝', lucideIcon: 'ShoppingCart',badgeColor: 'bg-warning/15 text-warning border-warning/30' },
  { value: 'clientes',         label: 'Clientes',          gradient: 'from-info to-success',                     icon: '⭐', lucideIcon: 'UserCheck',   badgeColor: 'bg-info/15 text-info border-info/30' },
  { value: 'financeiro',       label: 'Contabilidade',     gradient: 'from-success to-success',                  icon: '💰', lucideIcon: 'DollarSign',  badgeColor: 'bg-success/15 text-success border-success/30' },
  { value: 'operacao',         label: 'Operação',          gradient: 'from-accent-violet to-accent-violet',      icon: '⚙️', lucideIcon: 'Headphones',  badgeColor: 'bg-accent-violet/15 text-accent-violet border-accent-violet/30' },
  { value: 'produtos',         label: 'Produtos',          gradient: 'from-info to-info',                        icon: '📦', lucideIcon: 'Package',     badgeColor: 'bg-info/15 text-info border-info/30' },
  { value: 'recursos-humanos', label: 'Recursos Humanos',  gradient: 'from-destructive to-accent-violet',        icon: '👥', lucideIcon: 'UsersRound',  badgeColor: 'bg-destructive/15 text-destructive border-destructive/30' },
] as const;

/** Departments available for processes, routines, SOPs */
export const PROCESS_DEPARTMENTS = DEPARTMENTS;

export type DepartmentValue = (typeof DEPARTMENTS)[number]['value'];

export function getDept(val: string) {
  return DEPARTMENTS.find(d => d.value === val);
}

export function getDeptLabel(val: string) {
  return getDept(val)?.label || val;
}
