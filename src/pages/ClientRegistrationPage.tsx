import { Navigate } from 'react-router-dom';

// Redireciona para o Kanban de Cadastro de Clientes
export default function ClientRegistrationPage() {
  return <Navigate to="/kanban/cadastro-novos-clientes" replace />;
}
