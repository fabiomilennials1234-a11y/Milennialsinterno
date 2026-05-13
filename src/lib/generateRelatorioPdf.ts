import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';

export async function generateRelatorioPdf(
  element: HTMLElement,
  clientName: string,
): Promise<void> {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: '#000000',
    logging: false,
  });

  const imgWidth = 210; // A4 mm
  const pageHeight = 297;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF('p', 'mm', 'a4');
  let heightLeft = imgHeight;
  let position = 0;

  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
  heightLeft -= pageHeight;

  while (heightLeft > 0) {
    position -= pageHeight;
    pdf.addPage();
    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
  }

  const date = new Date().toISOString().split('T')[0];
  const safeName = clientName.replace(/[^a-zA-Z0-9À-ɏ ]/g, '').replace(/\s+/g, '-').toLowerCase();
  pdf.save(`relatorio-mktplace-${safeName}-${date}.pdf`);
}
