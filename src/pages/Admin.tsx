import { Navigate } from 'react-router-dom';

// Página Administração foi consolidada como tab dentro de /definicoes.
// Mantemos este redirect para compatibilidade com links antigos.
export default function AdminPage() {
  return <Navigate to="/definicoes" replace />;
}
