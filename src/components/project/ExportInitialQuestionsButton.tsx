import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

interface Props {
  clientId: string | null | undefined;
  clientName: string | null | undefined;
  projectName: string | null | undefined;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const formatAnswer = (a: string | null) => {
  if (!a || !a.trim()) return '<em style="color:#94a3b8">Sem resposta</em>';
  return escapeHtml(a).replace(/\n/g, '<br/>');
};

const parseFileUrls = (raw: any): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);
  try {
    const v = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(v) ? v.filter(Boolean) : [];
  } catch { return []; }
};

const fileNameFromUrl = (url: string): string => {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || url);
    // Strip leading uuid/timestamp prefixes like "1700000000-name.pdf"
    return last.replace(/^\d{10,}[-_]/, '');
  } catch {
    const parts = url.split('/');
    return decodeURIComponent(parts[parts.length - 1] || url);
  }
};

export function ExportInitialQuestionsButton({ clientId, clientName, projectName }: Props) {
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    if (!clientId) {
      toast.error('Este projeto não está ligado a um cliente.');
      return;
    }
    setLoading(true);
    try {
      // Find portal(s) for this client
      const { data: portals, error: pErr } = await supabase
        .from('client_portals').select('id').eq('client_id', clientId);
      if (pErr) throw pErr;
      const portalIds = (portals || []).map(p => p.id);
      if (portalIds.length === 0) {
        toast.info('Este cliente não tem portal configurado.');
        return;
      }

      const { data: questions, error: qErr } = await supabase
        .from('portal_initial_questions')
        .select('question, answer, file_urls, sort_order, answered_at')
        .in('portal_id', portalIds)
        .order('sort_order');
      if (qErr) throw qErr;

      if (!questions || questions.length === 0) {
        toast.info('Sem perguntas iniciais para este cliente.');
        return;
      }

      const today = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });
      const title = `Perguntas Iniciais — ${clientName || 'Cliente'}`;

      const itemsHtml = questions.map((q, i) => {
        const files = parseFileUrls((q as any).file_urls);
        const filesHtml = files.length
          ? `<div class="files"><strong>📎 Ficheiros anexados (${files.length}):</strong><ul>${files.map(u => {
              const name = fileNameFromUrl(u);
              return `<li><a href="${escapeHtml(u)}" target="_blank" rel="noopener">${escapeHtml(name)}</a> <span class="file-url">${escapeHtml(u)}</span></li>`;
            }).join('')}</ul></div>`
          : '';
        const answeredAt = (q as any).answered_at
          ? `<div class="meta">Respondida em ${new Date((q as any).answered_at).toLocaleDateString('pt-PT')}</div>`
          : '';
        return `
          <div class="qa">
            <div class="q"><span class="num">${i + 1}.</span> ${escapeHtml(q.question || '')}</div>
            <div class="a">${formatAnswer(q.answer)}</div>
            ${filesHtml}
            ${answeredAt}
          </div>`;
      }).join('');

      const w = window.open('', '_blank', 'width=900,height=700');
      if (!w) { toast.error('Permite popups para exportar o PDF.'); return; }
      w.document.write(`<!DOCTYPE html>
<html><head><title>${escapeHtml(title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" rel="stylesheet">
<style>
  @page { size: A4; margin: 18mm 16mm 20mm 16mm;
    @bottom-right { content: "Página " counter(page) " / " counter(pages); font-family: 'Inter', sans-serif; font-size: 8.5pt; color: #94a3b8; }
    @bottom-left { content: "${escapeHtml(title)}"; font-family: 'Inter', sans-serif; font-size: 8.5pt; color: #94a3b8; }
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { font-family: 'Inter', -apple-system, sans-serif; font-size: 10.5pt; color: #0f172a; line-height: 1.6; -webkit-font-smoothing: antialiased; }
  h1 { font-family: 'Plus Jakarta Sans', sans-serif; font-size: 22pt; font-weight: 800; letter-spacing: -0.02em; color: #0b1220; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; padding: 0 0 18px 0; margin: 0 0 28px 0; border-bottom: 3px solid #0f172a; position: relative; }
  .header::after { content: ""; position: absolute; left: 0; bottom: -3px; width: 80px; height: 3px; background: linear-gradient(90deg, #0f172a, transparent); }
  .subtitle { font-size: 9.5pt; color: #64748b; font-weight: 500; margin-top: 6px; letter-spacing: 0.02em; }
  .meta-block { text-align: right; font-size: 8.5pt; color: #64748b; line-height: 1.6; }
  .meta-block strong { color: #0f172a; display: block; font-size: 9pt; margin-bottom: 2px; }
  .qa { margin: 0 0 22px 0; padding: 14px 16px; background: #fafbfc; border-left: 3px solid #2E75B6; border-radius: 4px; page-break-inside: avoid; }
  .qa .q { font-weight: 700; color: #0b1220; font-size: 10.5pt; margin-bottom: 8px; line-height: 1.45; }
  .qa .q .num { color: #64748b; margin-right: 6px; }
  .qa .a { color: #1e293b; font-size: 10pt; white-space: pre-wrap; }
  .qa .files { margin-top: 10px; padding-top: 8px; border-top: 1px dashed #cbd5e1; font-size: 8.5pt; color: #475569; }
  .qa .files ul { margin: 6px 0 0 18px; list-style: none; padding: 0; }
  .qa .files li { margin: 0 0 4px 0; padding-left: 14px; position: relative; }
  .qa .files li::before { content: "📄"; position: absolute; left: 0; top: 0; font-size: 8pt; }
  .qa .files a { color: #2E75B6; text-decoration: underline; font-weight: 600; word-break: break-word; }
  .qa .files .file-url { display: block; font-size: 7.5pt; color: #94a3b8; word-break: break-all; margin-top: 1px; }
  .qa .meta { margin-top: 8px; font-size: 8pt; color: #94a3b8; font-style: italic; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .qa { page-break-inside: avoid; } }
</style></head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(clientName || 'Cliente')}</h1>
      <div class="subtitle">Perguntas iniciais${projectName ? ` · ${escapeHtml(projectName)}` : ''}</div>
    </div>
    <div class="meta-block">
      <strong>Exportado em</strong>
      ${today}
      <div style="margin-top:6px">${questions.length} perguntas</div>
    </div>
  </div>
  ${itemsHtml}
</body></html>`);
      w.document.close();
      setTimeout(() => {
        w.print();
        w.onafterprint = () => w.close();
        setTimeout(() => { try { w.close(); } catch {} }, 3000);
      }, 500);
    } catch (err: any) {
      toast.error('Erro ao exportar: ' + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading} className="gap-2">
      <FileDown className="h-3.5 w-3.5" />
      {loading ? 'A preparar...' : 'Exportar Q&A'}
    </Button>
  );
}