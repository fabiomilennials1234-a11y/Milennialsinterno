import { User, UserRole } from '@/types/auth';

// Apenas referência para seed (supabase/seed.sql). Login real via Supabase Auth.
// Não é importado pelo app; manter só para documentação dos usuários de demonstração.
export const MOCK_USERS: User[] = [
  {
    id: '1',
    name: 'Ricardo Oliveira',
    email: 'ceo@millennialsb2b.com',
    role: 'ceo',
    avatar: '',
  },
  {
    id: '2',
    name: 'Amanda Santos',
    email: 'projetos@millennialsb2b.com',
    role: 'gestor_projetos',
    avatar: '',
  },
  {
    id: '3',
    name: 'Carlos Mendes',
    email: 'ads@millennialsb2b.com',
    role: 'gestor_ads',
    avatar: '',
  },
  {
    id: '4',
    name: 'Beatriz Lima',
    email: 'sucesso@millennialsb2b.com',
    role: 'sucesso_cliente',
    avatar: '',
  },
  {
    id: '5',
    name: 'Lucas Ferreira',
    email: 'design@millennialsb2b.com',
    role: 'design',
    avatar: '',
  },
  {
    id: '6',
    name: 'Marina Costa',
    email: 'video@millennialsb2b.com',
    role: 'editor_video',
    avatar: '',
  },
  {
    id: '7',
    name: 'Felipe Rodrigues',
    email: 'dev@millennialsb2b.com',
    role: 'devs',
    avatar: '',
  },
  {
    id: '8',
    name: 'Juliana Alves',
    email: 'atrizes@millennialsb2b.com',
    role: 'atrizes_gravacao',
    avatar: '',
  },
  {
    id: '9',
    name: 'Bruno Nascimento',
    email: 'produtora@millennialsb2b.com',
    role: 'produtora',
    avatar: '',
  },
  {
    id: '10',
    name: 'Camila Souza',
    email: 'crm@millennialsb2b.com',
    role: 'gestor_crm',
    avatar: '',
  },
  {
    id: '11',
    name: 'Diego Martins',
    email: 'comercial@millennialsb2b.com',
    role: 'consultor_comercial',
    avatar: '',
  },
  {
    id: '12',
    name: 'Fernanda Gomes',
    email: 'financeiro@millennialsb2b.com',
    role: 'financeiro',
    avatar: '',
  },
  {
    id: '13',
    name: 'Gabriel Pereira',
    email: 'rh@millennialsb2b.com',
    role: 'rh',
    avatar: '',
  },
];

// Credenciais mock (apenas para demonstração)
export const MOCK_CREDENTIALS: Record<string, { password: string; userId: string }> = {
  'ceo@millennialsb2b.com': { password: 'ceo123', userId: '1' },
  'projetos@millennialsb2b.com': { password: 'projetos123', userId: '2' },
  'ads@millennialsb2b.com': { password: 'ads123', userId: '3' },
  'sucesso@millennialsb2b.com': { password: 'sucesso123', userId: '4' },
  'design@millennialsb2b.com': { password: 'design123', userId: '5' },
  'video@millennialsb2b.com': { password: 'video123', userId: '6' },
  'dev@millennialsb2b.com': { password: 'dev123', userId: '7' },
  'atrizes@millennialsb2b.com': { password: 'atrizes123', userId: '8' },
  'produtora@millennialsb2b.com': { password: 'produtora123', userId: '9' },
  'crm@millennialsb2b.com': { password: 'crm123', userId: '10' },
  'comercial@millennialsb2b.com': { password: 'comercial123', userId: '11' },
  'financeiro@millennialsb2b.com': { password: 'financeiro123', userId: '12' },
  'rh@millennialsb2b.com': { password: 'rh123', userId: '13' },
};

export function getUserById(id: string): User | undefined {
  return MOCK_USERS.find(user => user.id === id);
}

export function getUserByEmail(email: string): User | undefined {
  return MOCK_USERS.find(user => user.email === email);
}

export function getUsersByRole(role: UserRole): User[] {
  return MOCK_USERS.filter(user => user.role === role);
}

export function authenticateUser(email: string, password: string): User | null {
  const creds = MOCK_CREDENTIALS[email];
  if (creds && creds.password === password) {
    return getUserById(creds.userId) || null;
  }
  return null;
}
