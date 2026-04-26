import { Navigate } from 'react-router-dom';

// Análise Empresarial moved to Operação tab
export default function ExecutiveAnaliseEmpresarial() {
  return <Navigate to="/hub/operacao?tab=analise" replace />;
}
