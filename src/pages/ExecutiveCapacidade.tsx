import { Navigate } from 'react-router-dom';

// Redirect old capacity page to unified productivity page
export default function ExecutiveCapacidade() {
  return <Navigate to="/executive/productivity" replace />;
}
