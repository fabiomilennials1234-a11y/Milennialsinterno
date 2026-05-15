import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer';
import type { ResultsReport } from '@/hooks/useClientResultsReports';

const ACCENT = '#a78bfa';
const BG = '#0f0f14';
const TEXT_PRIMARY = '#ffffff';
const TEXT_SECONDARY = '#cccccc';
const TEXT_MUTED = '#888888';
const TEXT_SUBTLE = '#666666';
const BORDER = '#333333';
const BORDER_DARK = '#222222';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: BG,
    color: TEXT_PRIMARY,
    fontFamily: 'Helvetica',
  },
  coverPage: {
    padding: 40,
    backgroundColor: BG,
    color: TEXT_PRIMARY,
    fontFamily: 'Helvetica',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 8,
    color: TEXT_MUTED,
    marginBottom: 30,
    textAlign: 'center',
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: TEXT_PRIMARY,
  },
  coverSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#aaaaaa',
    marginBottom: 8,
  },
  coverLabel: {
    fontSize: 10,
    textAlign: 'center',
    color: ACCENT,
    marginBottom: 40,
    letterSpacing: 2,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: ACCENT,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  sectionContent: {
    fontSize: 11,
    color: TEXT_SECONDARY,
    lineHeight: 1.6,
    marginBottom: 20,
  },
  sectionImage: {
    width: '100%' as const,
    maxHeight: 200,
    objectFit: 'contain' as const,
    marginTop: 8,
    marginBottom: 16,
    borderRadius: 4,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: TEXT_SUBTLE,
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: BORDER_DARK,
    paddingTop: 8,
  },
  closingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: TEXT_PRIMARY,
    marginTop: 200,
  },
  closingSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: TEXT_MUTED,
    marginTop: 10,
  },
});

interface Props {
  report: ResultsReport;
  clientName: string;
}

interface Section {
  title: string;
  content: string | null;
  imageUrl?: string;
}

function buildSections(report: ResultsReport): Section[] {
  const imgs = ((report.custom_content as Record<string, unknown>)?.sectionImages || {}) as Record<string, string[]>;

  const raw: Section[] = [
    { title: 'Ações Realizadas nos Últimos 30 Dias', content: report.actions_last_30_days, imageUrl: imgs.actionsLast30Days?.[0] },
    { title: 'Conquistas Importantes', content: report.achievements, imageUrl: imgs.achievements?.[0] },
    { title: 'Resultados Detalhados de Tráfego Pago', content: report.traffic_results, imageUrl: imgs.trafficResults?.[0] },
    { title: 'Principais Métricas de Desempenho', content: report.key_metrics, imageUrl: imgs.keyMetrics?.[0] },
    { title: 'Campanha Top 1', content: report.top_campaign, imageUrl: imgs.topCampaign?.[0] },
    { title: 'O que Precisa ser Ajustado', content: report.improvement_points, imageUrl: imgs.improvementPoints?.[0] },
    { title: 'Análise do Funil Comercial', content: report.analise_funil_comercial, imageUrl: imgs.analiseFunilComercial?.[0] },
    { title: 'Indicadores de Domínio do Gestor', content: report.indicadores_dominio_gestor, imageUrl: imgs.indicadoresDominioGestor?.[0] },
    { title: 'Análise do CRM do Cliente', content: report.analise_crm_cliente, imageUrl: imgs.analiseCrmCliente?.[0] },
    { title: 'Análise das Estratégias de Captação', content: report.analise_estrategias_captacao, imageUrl: imgs.analiseEstrategiasCaptacao?.[0] },
    { title: 'Projeção do Funil — Próxima Quinzena', content: report.projecao_funil_quinzena, imageUrl: imgs.projecaoFunilQuinzena?.[0] },
    { title: 'Objetivos de Curto Prazo', content: report.objetivos_curto_prazo, imageUrl: imgs.objetivosCurtoPrazo?.[0] },
    { title: 'Agenda de Treinamentos Comerciais', content: report.agenda_treinamentos, imageUrl: imgs.agendaTreinamentos?.[0] },
    { title: 'Dica Comercial / Operacional', content: report.dica_comercial, imageUrl: imgs.dicaComercial?.[0] },
    { title: 'Vendas para Novos Clientes', content: report.vendas_novos_clientes, imageUrl: imgs.vendasNovosClientes?.[0] },
    { title: 'Ticket Médio Novos', content: report.ticket_medio_novos, imageUrl: imgs.ticketMedioNovos?.[0] },
    { title: 'Valor em Vendas Novos', content: report.valor_vendas_novos, imageUrl: imgs.valorVendasNovos?.[0] },
    { title: 'O que Faremos nos Próximos Dias', content: report.next_30_days, imageUrl: imgs.next30Days?.[0] },
  ];

  return raw.filter((s): s is Section & { content: string } => !!s.content);
}

export default function ResultsReportPDFDocument({ report, clientName }: Props) {
  const sections = buildSections(report);
  const period = `${report.cycle_start_date} a ${report.cycle_end_date}`;

  return (
    <Document>
      {/* Cover */}
      <Page size="A4" style={styles.coverPage}>
        {report.client_logo_url && (
          <Image src={report.client_logo_url} style={styles.logo} />
        )}
        <Text style={styles.coverTitle}>{clientName}</Text>
        <Text style={styles.coverSubtitle}>Relatório de Resultados</Text>
        <Text style={styles.coverLabel}>GESTÃO (QUINZENAL)</Text>
        <Text style={styles.header}>Millennials Growth Marketing B2B</Text>
        <Text style={styles.footer}>Período: {period}</Text>
      </Page>

      {/* Content — one section per page */}
      {sections.map((section, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          <Text style={styles.header}>
            {clientName} — Relatório de Resultados GESTÃO (QUINZENAL)
          </Text>
          <View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
            {section.imageUrl && (
              <Image src={section.imageUrl} style={styles.sectionImage} />
            )}
          </View>
          <Text style={styles.footer}>
            Millennials Growth Marketing B2B • {period}
          </Text>
        </Page>
      ))}

      {/* Closing */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.closingTitle}>Obrigado!</Text>
        <Text style={styles.closingSubtitle}>
          {clientName}{'\n'}Millennials Growth Marketing B2B
        </Text>
        <Text style={styles.footer}>
          Gerado automaticamente pelo Sistema Millennials
        </Text>
      </Page>
    </Document>
  );
}
