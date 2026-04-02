import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, FileText } from 'lucide-react';
import ResultsPresentationView from '@/components/results-report/ResultsPresentationView';
import type { ResultsReport } from '@/hooks/useClientResultsReports';

export default function PublicResultsReportPage() {
  const { token } = useParams<{ token: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['public-results-report', token],
    queryFn: async () => {
      if (!token) throw new Error('Token não fornecido');

      const { data: report, error: reportError } = await supabase
        .from('client_results_reports')
        .select('*')
        .eq('public_token', token)
        .eq('is_published', true)
        .maybeSingle();

      if (reportError) throw reportError;
      if (!report) throw new Error('Relatório não encontrado');

      // Get client name
      const { data: client } = await supabase
        .from('clients')
        .select('name')
        .eq('id', report.client_id)
        .single();

      return {
        report: report as ResultsReport,
        clientName: client?.name || 'Cliente',
      };
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white/40" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
        <div className="text-center space-y-4">
          <FileText className="mx-auto w-12 h-12 text-white/20" />
          <h1 className="text-xl font-bold">Relatório não encontrado</h1>
          <p className="text-white/50 text-sm">
            Este link pode ter expirado ou o relatório não está disponível.
          </p>
        </div>
      </div>
    );
  }

  return (
    <ResultsPresentationView
      report={data.report}
      clientName={data.clientName}
      clientLogoUrl={data.report.client_logo_url || undefined}
    />
  );
}
