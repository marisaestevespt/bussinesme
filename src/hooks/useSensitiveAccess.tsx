import { useAuth } from './useAuth';
import { usePermissions } from './usePermissions';

type SensitivityTag = 'financial' | 'legal';

const FINANCIAL_ROLES = ['contabilista'];
const LEGAL_ROLES = ['contabilista', 'advogada'];
const FINANCIAL_DEPTS = ['financeiro', 'admin'];
const ADMIN_DEPTS = ['admin'];

/**
 * Hook to check if the current user can see sensitive sections.
 * 
 * - `financial`: dados fiscais, valores, pagamentos, forma de pagamento
 *   → Owner, Admin dept, Contabilidade dept, role "Contabilista"
 * 
 * - `legal`: contratos, documentos legais
 *   → Owner, Admin dept, Contabilidade dept, role "Contabilista", role "Advogada"
 */
export function useSensitiveAccess() {
  const { isOwner } = useAuth();
  const { userDepartments, userRoleTitle } = usePermissions();

  const normalizedRole = (userRoleTitle || '').toLowerCase().trim();

  const canSee = (tag: SensitivityTag): boolean => {
    // Owners always see everything
    if (isOwner) return true;

    // Admin department sees everything
    if (userDepartments.some(d => ADMIN_DEPTS.includes(d))) return true;

    if (tag === 'financial') {
      // Contabilidade department or Contabilista role
      if (userDepartments.some(d => FINANCIAL_DEPTS.includes(d))) return true;
      if (FINANCIAL_ROLES.some(r => normalizedRole.includes(r))) return true;
    }

    if (tag === 'legal') {
      // Contabilidade department or Contabilista/Advogada role
      if (userDepartments.some(d => FINANCIAL_DEPTS.includes(d))) return true;
      if (LEGAL_ROLES.some(r => normalizedRole.includes(r))) return true;
    }

    return false;
  };

  return { canSee };
}
