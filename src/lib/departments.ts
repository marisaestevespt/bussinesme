// Shared department constants used across sidebar, processos, and other pages

export const DEPARTMENTS = [
  { value: 'admin', label: 'Administração', gradient: 'from-yellow-500 to-amber-700', icon: '👑', lucideIcon: 'Crown' },
  { value: 'marketing', label: 'Marketing', gradient: 'from-pink-500 to-rose-700', icon: '📣', lucideIcon: 'Megaphone' },
  { value: 'comercial', label: 'Comercial', gradient: 'from-amber-500 to-orange-700', icon: '🤝', lucideIcon: 'ShoppingCart' },
  { value: 'clientes', label: 'Clientes', gradient: 'from-cyan-500 to-teal-700', icon: '⭐', lucideIcon: 'UserCheck' },
  { value: 'financeiro', label: 'Contabilidade', gradient: 'from-emerald-500 to-green-800', icon: '💰', lucideIcon: 'DollarSign' },
  { value: 'operacao', label: 'Operação', gradient: 'from-violet-500 to-purple-800', icon: '⚙️', lucideIcon: 'Headphones' },
  { value: 'produtos', label: 'Produtos', gradient: 'from-indigo-500 to-blue-800', icon: '📦', lucideIcon: 'Package' },
  { value: 'recursos-humanos', label: 'Pessoas', gradient: 'from-rose-500 to-pink-800', icon: '👥', lucideIcon: 'UsersRound' },
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
