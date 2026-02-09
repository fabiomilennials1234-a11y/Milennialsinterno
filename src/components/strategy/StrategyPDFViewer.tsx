import { useState } from 'react';
import { PDFDownloadLink, PDFViewer } from '@react-pdf/renderer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Eye, Loader2, X } from 'lucide-react';
import { ClientStrategy } from '@/hooks/useClientStrategies';
import StrategyPDFDocument from './StrategyPDFDocument';

interface StrategyPDFViewerProps {
  strategy: ClientStrategy;
  clientName: string;
  isOpen: boolean;
  onClose: () => void;
}

export default function StrategyPDFViewer({
  strategy,
  clientName,
  isOpen,
  onClose,
}: StrategyPDFViewerProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl max-h-[95vh] p-0 flex flex-col bg-card border-primary/30">
        <DialogHeader className="px-6 py-4 border-b border-primary/30 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-warning flex items-center justify-center">
                <Eye className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  Visualizar Estratégia PRO+
                </DialogTitle>
                <p className="text-sm text-muted-foreground">
                  Cliente: {clientName}
                </p>
              </div>
            </div>
            <PDFDownloadLink
              document={<StrategyPDFDocument strategy={strategy} clientName={clientName} />}
              fileName={`estrategia-pro-${clientName.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`}
            >
              {({ loading }) => (
                <Button variant="default" disabled={loading} className="gap-2">
                  {loading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  Baixar PDF
                </Button>
              )}
            </PDFDownloadLink>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden bg-muted/30 min-h-[600px]">
          <PDFViewer
            style={{ width: '100%', height: '100%', border: 'none', minHeight: '600px' }}
            showToolbar={false}
          >
            <StrategyPDFDocument strategy={strategy} clientName={clientName} />
          </PDFViewer>
        </div>
      </DialogContent>
    </Dialog>
  );
}
