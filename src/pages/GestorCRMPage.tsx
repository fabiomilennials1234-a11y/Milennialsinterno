import MainLayout from '@/layouts/MainLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { ExternalLink, AlertCircle, Trello } from 'lucide-react';
import { Button } from '@/components/ui/button';

const TRELLO_LINK = 'https://trello.com/invite/b/68727eab42762ec5bf40b8fd/ATTI8bf3cedfe27ee1335e046749457de29fB922EDB8/10-gestor-de-crm';

export default function GestorCRMPage() {
  const { user, isCEO, isAdminUser } = useAuth();

  const allowedRoles = ['gestor_crm', 'gestor_projetos', 'ceo'];
  const canAccess = user?.role && allowedRoles.includes(user.role);

  if (!canAccess && !isCEO && !isAdminUser) {
    return <Navigate to="/" replace />;
  }

  const handleOpenTrello = () => {
    window.open(TRELLO_LINK, '_blank', 'noopener,noreferrer');
  };

  return (
    <MainLayout>
      <div className="h-full flex flex-col items-center justify-center bg-background p-8">
        <div className="max-w-2xl w-full text-center space-y-12">
          {/* Header */}
          <div className="space-y-4">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-4">
              <Trello className="w-10 h-10 text-primary" />
            </div>
            <h1 className="text-display text-foreground">
              Gestor de CRM PRO+
            </h1>
            <p className="text-body text-muted-foreground max-w-md mx-auto">
              Gerencie seus clientes de forma eficiente com nosso sistema de CRM integrado
            </p>
          </div>

          {/* Main CTA Card */}
          <div className="relative group">
            <div className="absolute -inset-1 bg-gradient-to-r from-primary via-purple-500 to-primary rounded-2xl blur-lg opacity-25 group-hover:opacity-40 transition-opacity duration-500" />
            <div className="relative bg-card border border-subtle rounded-2xl p-8 shadow-apple-lg">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h2 className="text-title text-foreground">
                    Crie um CRM Trello automático
                  </h2>
                  <p className="text-caption text-muted-foreground">
                    Clique no botão abaixo para acessar o template e começar a usar
                  </p>
                </div>

                <Button
                  onClick={handleOpenTrello}
                  size="lg"
                  className="w-full sm:w-auto px-8 py-6 text-base font-semibold rounded-xl bg-primary hover:bg-primary/90 transition-all duration-300 hover:shadow-lg hover:scale-[1.02]"
                >
                  <Trello className="w-5 h-5 mr-2" />
                  Acessar Template do Trello
                  <ExternalLink className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>

          {/* Warning Notice */}
          <div className="p-8 rounded-2xl bg-muted border border-border">
            <div className="flex items-center justify-center gap-3 mb-4">
              <AlertCircle className="w-6 h-6 text-foreground" />
              <p className="text-xl font-bold text-foreground">
                Importante
              </p>
            </div>
            <p className="text-lg text-foreground text-center">
              Antes de criar, certifique com o Consultor Comercial se o CRM será via Trello ou via Torque.
            </p>
          </div>

          {/* Footer info */}
          <p className="text-caption text-muted-foreground/60">
            O CRM ajuda você a organizar e acompanhar todos os seus leads e clientes em um só lugar.
          </p>
        </div>
      </div>
    </MainLayout>
  );
}
