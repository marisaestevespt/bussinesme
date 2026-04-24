/**
 * Derive a contract's effective status from its dates.
 * - If end_date in the past → 'terminado'
 * - If start_date in the future → 'em_renovacao' (pending)
 * - Otherwise → 'ativo'
 * The stored status only "wins" when it's 'em_renovacao' and dates haven't been set,
 * so the user can manually flag a contract that's mid-renewal.
 */
export function deriveContractStatus(contract: { start_date?: string | null; end_date?: string | null; status?: string | null }): 'ativo' | 'terminado' | 'em_renovacao' {
  const today = new Date().toISOString().slice(0, 10);

  if (contract.end_date && contract.end_date < today) return 'terminado';
  if (contract.start_date && contract.start_date > today) return 'em_renovacao';

  // Manual override: only honour if dates don't already imply 'terminado'
  if (contract.status === 'em_renovacao') return 'em_renovacao';

  return 'ativo';
}