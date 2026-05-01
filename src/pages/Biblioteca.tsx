import { Navigate } from 'react-router-dom';

// Biblioteca foi movida para dentro de Processos como tab.
export default function BibliotecaPage() {
  return <Navigate to="/hub/processos?tab=biblioteca" replace />;
}
