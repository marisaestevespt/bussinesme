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

export const formRules = {
  saleSeller: validateSaleSeller,
  expensePaymentMethod: validateExpensePaymentMethod,
  deliverableTeamRole: validateDeliverableTeamRole,
};