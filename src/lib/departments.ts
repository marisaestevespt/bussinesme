// Shared department constants used across sidebar, processos, and other pages

export const DEPARTMENTS = [
  { value: 'admin', label: 'Admin', gradient: 'from-yellow-500 to-amber-700', icon: '👑', lucideIcon: 'Crown' },
  { value: 'administrativo', label: 'Administrativo', gradient: 'from-slate-600 to-slate-800', icon: '🏢', lucideIcon: 'Building2' },
  { value: 'marketing', label: 'Marketing', gradient: 'from-pink-500 to-rose-700', icon: '📣', lucideIcon: 'Megaphone' },
  { value: 'comercial', label: 'Comercial', gradient: 'from-amber-500 to-orange-700', icon: '🤝', lucideIcon: 'ShoppingCart' },
  { value: 'clientes', label: 'Clientes', gradient: 'from-cyan-500 to-teal-700', icon: '⭐', lucideIcon: 'UserCheck' },
  { value: 'financeiro', label: 'Financeiro', gradient: 'from-emerald-500 to-green-800', icon: '💰', lucideIcon: 'DollarSign' },
  { value: 'operacao', label: 'Operação', gradient: 'from-violet-500 to-purple-800', icon: '⚙️', lucideIcon: 'Headphones' },
  { value: 'produtos', label: 'Produtos', gradient: 'from-indigo-500 to-blue-800', icon: '📦', lucideIcon: 'Package' },
  { value: 'customer-success', label: 'Customer Success', gradient: 'from-teal-500 to-cyan-800', icon: '🎯', lucideIcon: 'Heart' },
  { value: 'recursos-humanos', label: 'Recursos Humanos', gradient: 'from-rose-500 to-pink-800', icon: '👥', lucideIcon: 'UsersRound' },
] as const;

export type DepartmentValue = (typeof DEPARTMENTS)[number]['value'];

export function getDept(val: string) {
  return DEPARTMENTS.find(d => d.value === val);
}

export function getDeptLabel(val: string) {
  return getDept(val)?.label || val;
}
