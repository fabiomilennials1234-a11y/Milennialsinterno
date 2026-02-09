import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import logo from '@/assets/logo.png';
import iconBolt from '@/assets/icon-bolt.png';
import { Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (!success) {
        setError('Credenciais inválidas. Verifique seu e-mail e senha.');
      }
    } catch (err) {
      setError('Erro ao fazer login. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Lado esquerdo - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-secondary relative overflow-hidden">
        <div className="absolute inset-0 flex flex-col items-center justify-center p-12">
          <img 
            src={logo} 
            alt="Millennials B2B" 
            className="w-64 mb-8 animate-fade-in"
          />
          <p className="text-secondary-foreground/70 text-center font-body text-lg max-w-md">
            Sistema de Gestão de Processos Empresariais
          </p>
        </div>
        
        {/* Decorative element */}
        <img 
          src={iconBolt} 
          alt="" 
          className="absolute -bottom-20 -right-20 w-96 opacity-10"
        />
      </div>

      {/* Lado direito - Formulário */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md animate-slide-up">
          {/* Logo mobile */}
          <div className="lg:hidden flex justify-center mb-8">
            <img src={logo} alt="Millennials B2B" className="h-12" />
          </div>

          <div className="mb-8">
            <h1 className="font-display text-2xl font-bold text-foreground tracking-wide uppercase">
              Acesse sua conta
            </h1>
            <p className="text-muted-foreground mt-2 font-body">
              Entre com suas credenciais para acessar o sistema
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                className="input-apple"
                required
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-apple pr-12"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-4 rounded-xl bg-danger/10 border border-danger/20 text-danger text-sm animate-scale-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl
                         bg-primary text-primary-foreground font-display font-semibold uppercase tracking-wider
                         hover:brightness-105 active:scale-[0.98] transition-all duration-200
                         disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="animate-pulse">Entrando...</span>
              ) : (
                <>
                  <span>Entrar</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}
