import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer';
import type { ResultsReport } from '@/hooks/useClientResultsReports';

const styles = StyleSheet.create({
  page: {
    padding: 40,
    backgroundColor: '#0f0f14',
    color: '#ffffff',
    fontFamily: 'Helvetica',
  },
  coverPage: {
    padding: 40,
    backgroundColor: '#0f0f14',
    color: '#ffffff',
    fontFamily: 'Helvetica',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    fontSize: 8,
    color: '#888888',
    marginBottom: 30,
    textAlign: 'center',
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#ffffff',
  },
  coverSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    color: '#aaaaaa',
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#a78bfa',
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#333333',
  },
  sectionContent: {
    fontSize: 11,
    color: '#cccccc',
    lineHeight: 1.6,
    marginBottom: 20,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 20,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#666666',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#222222',
    paddingTop: 8,
  },
  closingTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: '#ffffff',
    marginTop: 200,
  },
  closingSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    color: '#888888',
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

const sectionImageStyle = {
  width: '100%' as const,
  maxHeight: 200,
  objectFit: 'contain' as const,
  marginTop: 8,
  marginBottom: 16,
  borderRadius: 4,
};

export default function ResultsReportPDFDocument({ report, clientName }: Props) {
  const imgs = ((report.custom_content as any)?.sectionImages || {}) as Record<string, string[]>;

  const sections: Section[] = [
    { title: 'Ações Realizadas nos Últimos 30 Dias', content: report.actions_last_30_days, imageUrl: imgs.actionsLast30Days?.[0] },
    { title: 'Conquistas Importantes', content: report.achievements, imageUrl: imgs.achievements?.[0] },
    { title: 'Resultados de Tráfego Pago', content: report.traffic_results, imageUrl: imgs.trafficResults?.[0] },
    { title: 'Métricas de Desempenho', content: report.key_metrics, imageUrl: imgs.keyMetrics?.[0] },
    { title: 'Campanha Top 1', content: report.top_campaign, imageUrl: imgs.topCampaign?.[0] },
    { title: 'Pontos a Melhorar', content: report.improvement_points, imageUrl: imgs.improvementPoints?.[0] },
    { title: 'Próximos 30 Dias', content: report.next_30_days, imageUrl: imgs.next30Days?.[0] },
    { title: 'Próximos Passos', content: report.next_steps, imageUrl: imgs.nextSteps?.[0] },
  ].filter(s => s.content);

  return (
    <Document>
      {/* Cover page */}
      <Page size="A4" style={styles.coverPage}>
        {report.client_logo_url && (
          <Image src={report.client_logo_url} style={styles.logo} />
        )}
        <Text style={styles.coverTitle}>{clientName}</Text>
        <Text style={styles.coverSubtitle}>Relatório de Resultados{'\n'}Últimos 30 dias</Text>
        <Text style={styles.header}>Millennials Growth Marketing B2B</Text>
        <Text style={styles.footer}>
          Período: {report.cycle_start_date} a {report.cycle_end_date}
        </Text>
      </Page>

      {/* Content pages — 1 section per page to fit image + text */}
      {sections.map((section, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          <Text style={styles.header}>
            {clientName} — Relatório de Resultados
          </Text>
          <View>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            <Text style={styles.sectionContent}>{section.content}</Text>
            {section.imageUrl && (
              <Image src={section.imageUrl} style={sectionImageStyle} />
            )}
          </View>
          <Text style={styles.footer}>
            Millennials Growth Marketing B2B • {report.cycle_start_date} a {report.cycle_end_date}
          </Text>
        </Page>
      ))}

      {/* Closing page */}
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
