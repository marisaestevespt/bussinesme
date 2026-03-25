import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Plus, CalendarIcon, Trash2, Upload, ExternalLink } from 'lucide-react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { useFinancialData } from '@/hooks/useFinancialData';

const DOC_TYPES = [
  { value: 'declaracao_iva', label: 'Declaração de IVA' },
  { value: 'declaracao_ss', label: 'Declaração de Segurança Social' },
  { value: 'comprovativo_pagamento', label: 'Comprovativo de Pagamento' },
  { value: 'recibo', label: 'Recibo' },
  { value: 'outro', label: 'Outro' },
];

const DOC_STATUS = [
  { value: 'por_submeter', label: 'Por Submeter' },
  { value: 'submetido', label: 'Submetido' },
  { value: 'pago', label: 'Pago' },
  { value: 'arquivado', label: 'Arquivado' },
];

const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

interface Props { fin: ReturnType<typeof useFinancialData>; }

export function FinDocumentos({ fin }: Props) {
  const docs = fin.documents.data || [];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});
  const today = new Date();

  const openNew = () => {
    setForm({ doc_type: 'outro', status: 'por_submeter', title: '', period_month: '', period_year: new Date().getFullYear().toString() });
    setOpen(true);
  };

  const save = async () => {
    if (!form.title?.trim()) { toast.error('Título é obrigatório'); return; }
    await fin.upsertDocument.mutateAsync({
      ...(form.id ? { id: form.id } : {}),
      title: form.title,
      doc_type: form.doc_type,
      period_month: form.period_month ? parseInt(form.period_month) : null,
      period_year: form.period_year ? parseInt(form.period_year) : null,
      due_date: form.due_date ? (typeof form.due_date === 'string' ? form.due_date : format(form.due_date, 'yyyy-MM-dd')) : null,
      status: form.status,
      document_url: form.document_url || null,
      document_name: form.document_name || null,
      notes: form.notes || null,
    });
    setOpen(false);
    toast.success('Documento guardado');
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Novo Documento</Button>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Data de Entrega</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Documento</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sem documentos</TableCell></TableRow>
              ) : docs.map(d => {
                const urgent = d.due_date && d.status === 'por_submeter' && differenceInDays(parseISO(d.due_date), today) <= 15 && differenceInDays(parseISO(d.due_date), today) >= 0;
                return (
                  <TableRow key={d.id} className="cursor-pointer hover:bg-muted/50" onClick={() => {
                    setForm({ ...d, due_date: d.due_date ? new Date(d.due_date + 'T00:00:00') : undefined, period_month: d.period_month?.toString() || '', period_year: d.period_year?.toString() || '' });
                    setOpen(true);
                  }}>
                    <TableCell className="font-medium">{d.title}</TableCell>
                    <TableCell>{DOC_TYPES.find(t => t.value === d.doc_type)?.label || d.doc_type}</TableCell>
                    <TableCell>{d.period_month ? `${MONTHS[d.period_month - 1]} ${d.period_year || ''}` : d.period_year || '—'}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {d.due_date || '—'}
                        {urgent && <Badge variant="outline" className="bg-destructive/10 text-destructive text-xs">Urgente</Badge>}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={d.status === 'por_submeter' ? 'bg-warning/10 text-warning' : d.status === 'submetido' ? 'bg-info/10 text-info' : d.status === 'pago' ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                        {DOC_STATUS.find(s => s.value === d.status)?.label || d.status}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      {d.document_url ? <a href={d.document_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1"><ExternalLink className="h-3.5 w-3.5" /> {d.document_name || 'Ver'}</a> : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{form.id ? 'Editar Documento' : 'Novo Documento'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Título</Label><Input value={form.title || ''} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} /></div>
            <div><Label>Tipo</Label>
              <Select value={form.doc_type || 'outro'} onValueChange={v => setForm((f: any) => ({ ...f, doc_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_TYPES.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Mês</Label>
                <Select value={form.period_month || ''} onValueChange={v => setForm((f: any) => ({ ...f, period_month: v }))}>
                  <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Ano</Label><Input type="number" value={form.period_year || ''} onChange={e => setForm((f: any) => ({ ...f, period_year: e.target.value }))} /></div>
            </div>
            <div><Label>Data de Entrega / Pagamento</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start", !form.due_date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {form.due_date ? format(form.due_date instanceof Date ? form.due_date : new Date(form.due_date), 'dd/MM/yyyy') : 'Selecionar'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={form.due_date instanceof Date ? form.due_date : undefined} onSelect={d => setForm((f: any) => ({ ...f, due_date: d }))} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>
            <div><Label>Status</Label>
              <Select value={form.status || 'por_submeter'} onValueChange={v => setForm((f: any) => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{DOC_STATUS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Documento (link ou upload)</Label>
              <div className="flex gap-2">
                <Input value={form.document_url || ''} onChange={e => setForm((f: any) => ({ ...f, document_url: e.target.value, document_name: e.target.value }))} placeholder="https://..." className="flex-1" />
                <label>
                  <Button variant="outline" size="icon" asChild><span><Upload className="h-4 w-4" /></span></Button>
                  <input type="file" className="hidden" onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const path = `financial/${Date.now()}-${file.name}`;
                    const { error } = await supabase.storage.from('commercial-files').upload(path, file);
                    if (error) { toast.error('Erro ao enviar'); return; }
                    const { data: urlData } = supabase.storage.from('commercial-files').getPublicUrl(path);
                    setForm((f: any) => ({ ...f, document_url: urlData.publicUrl, document_name: file.name }));
                    toast.success('Ficheiro enviado');
                  }} />
                </label>
              </div>
            </div>
            <div><Label>Notas</Label><Input value={form.notes || ''} onChange={e => setForm((f: any) => ({ ...f, notes: e.target.value }))} /></div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={save}>Guardar</Button>
              {form.id && <Button variant="destructive" size="icon" onClick={async () => { await fin.deleteDocument.mutateAsync(form.id); setOpen(false); toast.success('Eliminado'); }}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
