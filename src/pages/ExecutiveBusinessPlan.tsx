import { Navigate } from 'react-router-dom';

/**
 * Página antiga `/executive/business-plan`. O conteúdo mudou de casa:
 * o canvas + secção estratégica vivem agora em
 * `/executive/planeamento/estrategico`. Mantemos o redirect para
 * não partir links/bookmarks existentes.
 */
export default function ExecutiveBusinessPlan() {
  return <Navigate to="/executive/planeamento/estrategico" replace />;
}
