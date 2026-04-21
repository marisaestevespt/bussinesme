/**
 * Exports a section of the page as a PDF using the browser's print dialog.
 * Clones the target element into a new window with clean styling for print.
 */
export function exportPdf(title: string, elementId: string) {
  const el = document.getElementById(elementId);
  if (!el) return;

  const printWindow = window.open('', '_blank', 'width=900,height=700');
  if (!printWindow) return;

  // Get computed CSS variables from the root for theming
  const rootStyles = getComputedStyle(document.documentElement);
  const bg = rootStyles.getPropertyValue('--background').trim();
  const fg = rootStyles.getPropertyValue('--foreground').trim();

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
<title>${title}</title>
<style>
  @page { size: A4; margin: 15mm 12mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; padding: 0; }
  h1 { font-size: 18px; font-weight: 700; margin-bottom: 6px; }
  h2 { font-size: 14px; font-weight: 600; margin-top: 16px; margin-bottom: 6px; }
  h3 { font-size: 12px; font-weight: 600; margin-top: 12px; margin-bottom: 4px; }
  p { margin-bottom: 4px; }
  
  /* Cards as bordered boxes */
  [class*="rounded-"] { border: 1px solid #e5e7eb; border-radius: 6px; padding: 10px; margin-bottom: 8px; page-break-inside: avoid; }
  
  /* Tables */
  table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10px; }
  th, td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; text-align: left; }
  th { font-weight: 600; background: #f9fafb; border-bottom: 2px solid #d1d5db; }
  tr:last-child td { border-bottom: none; }
  .text-right { text-align: right; }
  
  /* Grid layout approximation */
  .grid { display: flex; flex-wrap: wrap; gap: 8px; }
  .grid > * { flex: 1; min-width: 120px; }
  
  /* Colors */
  .text-success, .text-success { color: #059669; }
  .text-destructive { color: #dc2626; }
  .text-warning { color: #d97706; }
  .text-muted-foreground { color: #6b7280; }
  
  /* Charts — hide in print, they don't render in a new window */
  .recharts-responsive-container, .recharts-wrapper, [class*="h-72"], [class*="h-64"], [class*="h-48"] { display: none !important; }
  
  /* Buttons, tabs, interactive elements — hide */
  button, [role="tablist"], .cursor-pointer { display: none !important; }
  
  /* Badge */
  [class*="badge"] { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; background: #f3f4f6; }
  
  /* Separator */
  [role="separator"] { border: none; border-top: 1px solid #e5e7eb; margin: 12px 0; }
  
  /* Font weights */
  .font-bold { font-weight: 700; }
  .font-semibold { font-weight: 600; }
  .font-medium { font-weight: 500; }
  
  /* Print header */
  .pdf-header { border-bottom: 2px solid #1a1a1a; padding-bottom: 8px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; }
  .pdf-header h1 { margin: 0; }
  .pdf-date { font-size: 10px; color: #6b7280; }
  
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
  <div class="pdf-header">
    <h1>${title}</h1>
    <span class="pdf-date">Exportado em ${new Date().toLocaleDateString('pt-PT')}</span>
  </div>
  ${el.innerHTML}
</body>
</html>`);

  printWindow.document.close();

  // Wait for content to load then trigger print
  setTimeout(() => {
    printWindow.print();
    // Close window after print dialog closes
    printWindow.onafterprint = () => printWindow.close();
    // Fallback close after delay
    setTimeout(() => { try { printWindow.close(); } catch {} }, 3000);
  }, 500);
}
