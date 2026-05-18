/**
 * Pure form-validation rules introduced in Bloco B (data-integrity pass).
 * Centralised here so they are testable and reusable across dialogs.
 * Each rule returns `null` when valid, or a Portuguese error message when invalid.
 */

export function validateSaleSeller(assignedTo: string | null | undefined): string | null {
  if (!assignedTo || !assignedTo.trim()) return 'Seleciona o vendedor responsável.';
  return null;
}

export function validateExpensePaymentMethod(method: string | null | undefined): string | null {
  if (!method || !method.trim()) return 'Indica o método de pagamento.';
  return null;
}

export function validateDeliverableTeamRole(
  responsibleType: string | null | undefined,
  responsibleRole: string | null | undefined,
  assignedTo: string | null | undefined
): string | null {
  if (responsibleType !== 'equipa') return null;
  if ((responsibleRole && responsibleRole.trim()) || (assignedTo && assignedTo.trim())) return null;
  return 'Entregas da equipa precisam de função (role) ou membro atribuído.';
}

/**
 * Projetos com modo `pontual` em estado ativo (não concluído/arquivado/cancelado)
 * devem ter deadline para entrar no plano e relatórios.
 */
export function validateProjectDeadline(
  projectMode: string | null | undefined,
  status: string | null | undefined,
  deadline: string | Date | null | undefined
): string | null {
  if (projectMode === 'recorrente') return null;
  const inactive = new Set(['concluido', 'arquivo', 'arquivado', 'cancelado']);
  if (inactive.has((status || '').toLowerCase())) return null;
  if (!deadline) return 'Define a data de entrega (deadline) do projeto.';
  return null;
}

export const formRules = {
  saleSeller: validateSaleSeller,
  expensePaymentMethod: validateExpensePaymentMethod,
  deliverableTeamRole: validateDeliverableTeamRole,
  projectDeadline: validateProjectDeadline,
};