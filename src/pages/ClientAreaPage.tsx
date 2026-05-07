import { useState } from 'react';
import MainLayout from '@/layouts/MainLayout';
import { useClientArea, type ClientAreaItem } from '@/hooks/useClientArea';
import ClientAreaMetrics from '@/components/client-area/ClientAreaMetrics';
import ClientAreaTable from '@/components/client-area/ClientAreaTable';
import ClientApprovalModal from '@/components/client-area/ClientApprovalModal';
import { Users, Loader2 } from 'lucide-react';

export default function ClientAreaPage() {
  const { data: clients, isLoading, error } = useClientArea();
  const [selectedClient, setSelectedClient] = useState<ClientAreaItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const handleSelectClient = (client: ClientAreaItem) => {
    setSelectedClient(client);
    setModalOpen(true);
  };

  return (
    <MainLayout>
      <div className="min-h-screen">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="rounded-lg bg-primary/10 p-2">
              <Users size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Clientes</h1>
              <p className="text-xs text-muted-foreground/50">
                Visao centralizada de todos os clientes da operacao
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 space-y-6 pb-12">
          {isLoading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 size={24} className="animate-spin text-muted-foreground/30" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-24">
              <p className="text-sm text-red-400">Erro ao carregar clientes</p>
            </div>
          ) : (
            <>
              <ClientAreaMetrics clients={clients || []} />
              <ClientAreaTable
                clients={clients || []}
                onSelectClient={handleSelectClient}
              />
            </>
          )}
        </div>

        {/* Approval Modal */}
        <ClientApprovalModal
          client={selectedClient}
          open={modalOpen}
          onOpenChange={setModalOpen}
        />
      </div>
    </MainLayout>
  );
}
