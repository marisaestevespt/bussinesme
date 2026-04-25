// Shared department constants used across sidebar, processos, and other pages

export const DEPARTMENTS = [
  { value: 'admin', label: 'Administração', gradient: 'from-warning to-warning', icon: '👑', lucideIcon: 'Crown' },
  { value: 'marketing', label: 'Marketing', gradient: 'from-accent-violet to-destructive', icon: '📣', lucideIcon: 'Megaphone' },
  { value: 'comercial', label: 'Comercial', gradient: 'from-warning to-warning', icon: '🤝', lucideIcon: 'ShoppingCart' },
  { value: 'clientes', label: 'Clientes', gradient: 'from-info to-success', icon: '⭐', lucideIcon: 'UserCheck' },
  { value: 'financeiro', label: 'Contabilidade', gradient: 'from-success to-success', icon: '💰', lucideIcon: 'DollarSign' },
  { value: 'operacao', label: 'Operação', gradient: 'from-accent-violet to-accent-violet', icon: '⚙️', lucideIcon: 'Headphones' },
  { value: 'produtos', label: 'Produtos', gradient: 'from-info to-info', icon: '📦', lucideIcon: 'Package' },
  { value: 'recursos-humanos', label: 'Recursos Humanos', gradient: 'from-destructive to-accent-violet', icon: '👥', lucideIcon: 'UsersRound' },
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
