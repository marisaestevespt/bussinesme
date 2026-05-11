import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { CalendarIcon, Check, Copy, Trash2, X, Plus, History, DollarSign, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { resolveProductId } from '@/lib/productResolver';
import { PastLaunchesDialog } from './PastLaunchesDialog';
import { EmptyHint } from '@/components/ui/loading-skeletons';

const ENTRY_TYPES = ['Lançamento', 'Relançamento', 'Campanha', 'Sequência de Email', 'Promoção', 'Outro'];
const RESULTS = ['Funcionou', 'Não Funcionou', 'Parcialmente'];

interface MaterialLink { label: string; url: string; }

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entry: any;
  isNew: boolean;
  products: string[];
}

export function LibraryEntrySheet({ open, onOpenChange, entry, isNew, products }: Props) {
  const queryClient = useQueryClient();
  const { isOwner, user } = useAuth();

  const [title, setTitle] = useState('');
  const [entryType, setEntryType] = useState('Outro');
  const [product, setProduct] = useState('');
  const [projectId, setProjectId] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [result, setResult] = useState('Parcialmente');
  const [summary, setSummary] = useState('');
  const [whatWorked, setWhatWorked] = useState('');
  const [whatDidntWork, setWhatDidntWork] = useState('');
  const [resultsNumbers, setResultsNumbers] = useState('');
  const [learnings, setLearnings] = useState('');
  const [materials, setMaterials] = useState<MaterialLink[]>([]);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [pastLaunchesOpen, setPastLaunchesOpen] = useState(false);
  const [promptShown, setPromptShown] = useState(false);
  const [promptOpen, setPromptOpen] = useState(false);

  // Fetch projects for selector
  const { data: projects = [] } = useQuery({
    queryKey: ['projects-list-simple'],
    queryFn: async () => {
      const { data } = await supabase.from('projects').select('id, name').order('name').is('archived_at', null);
      return data || [];
    },
  });

  // Calculate revenue from sales linked to project
  const { data: launchRevenue } = useQuery({
    queryKey: ['launch-revenue', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data } = await supabase
        .from('commercial_sales')
        .select('base_value, status')
        .eq('project_id', projectId)
        .neq('status', 'cancelada');
      if (!data) return 0;
      return data.reduce((sum, s) => sum + (s.base_value || 0), 0);
    },
  });

  // Fetch past launches for same product
  const { data: pastLaunches = [] } = useQuery({
    queryKey: ['past-launches', product],
    enabled: !!product && (entryType === 'Lançamento' || entryType === 'Relançamento'),
    queryFn: async () => {
      const productId = await resolveProductId(product);
      let query = supabase
        .from('commercial_library_entries')
        .select('id, title, entry_type, product, product_id, start_date, end_date, result, summary, what_worked, what_didnt_work, results_numbers, learnings')
        .in('entry_type', ['Lançamento', 'Relançamento'])
        .order('created_at', { ascending: false });
      // Prefer relational filter; fall back to name only if product is unknown.
      query = productId ? query.eq('product_id', productId) : query.eq('product', product);
      const { data } = await query;
      // Exclude current entry if editing
      return (data || []).filter((l: any) => !entry || l.id !== entry.id);
    },
  });

  // Fetch content items linked to this launch
  const { data: linkedContent = [] } = useQuery({
    queryKey: ['launch-content', entry?.id],
    enabled: !!entry?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from('content_items')
        .select('id, title, status, scheduled_at')
        .eq('launch_id', entry.id)
        .order('scheduled_at', { ascending: true });
      return data || [];
    },
  });

  useEffect(() => {
    if (entry && !isNew) {
      setTitle(entry.title || '');
      setEntryType(entry.entry_type || 'Outro');
      setProduct(entry.product || '');
      setProjectId(entry.project_id || '');
      setStartDate(entry.start_date ? new Date(entry.start_date) : undefined);
      setEndDate(entry.end_date ? new Date(entry.end_date) : undefined);
      setResult(entry.result || 'Parcialmente');
      setSummary(entry.summary || '');
      setWhatWorked(entry.what_worked || '');
      setWhatDidntWork(entry.what_didnt_work || '');
      setResultsNumbers(entry.results_numbers || '');
      setLearnings(entry.learnings || '');
      setMaterials((entry.materials as MaterialLink[]) || []);
      setNotes(entry.notes || '');
      setPromptShown(false);
    } else if (isNew) {
      setTitle(''); setEntryType('Outro'); setProduct(''); setProjectId('');
      setStartDate(undefined); setEndDate(undefined); setResult('Parcialmente');
      setSummary(''); setWhatWorked(''); setWhatDidntWork('');
      setResultsNumbers(''); setLearnings(''); setMaterials([]); setNotes('');
      setPromptShown(false);
    }
  }, [entry, isNew, open]);

  // Show prompt when product is selected and there are past launches
  useEffect(() => {
    if (isNew && product && !promptShown && pastLaunches.length > 0 && (entryType === 'Lançamento' || entryType === 'Relançamento')) {
      setPromptOpen(true);
      setPromptShown(true);
    }
  }, [product, pastLaunches, isNew, promptShown, entryType]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('O título é obrigatório'); return; }
    setSaving(true);
    try {
      const productId = await resolveProductId(product);
      const payload = {
        title: title.trim(),
        entry_type: entryType,
        product: product || null,
        product_id: productId,
        project_id: projectId || null,
        start_date: startDate ? format(startDate, 'yyyy-MM-dd') : null,
        end_date: endDate ? format(endDate, 'yyyy-MM-dd') : null,
        result,
        summary: summary || null,
        what_worked: whatWorked || null,
        what_didnt_work: whatDidntWork || null,
        results_numbers: resultsNumbers || null,
        learnings: learnings || null,
        materials: materials as any,
        notes: notes || null,
        updated_at: new Date().toISOString(),
      };

      if (isNew) {
        const { error } = await supabase.from('commercial_library_entries').insert({ ...payload, created_by: user?.id } as any);
        if (error) throw error;
        toast.success('Entrada criada');
      } else {
        const { error } = await supabase.from('commercial_library_entries').update(payload as any).eq('id', entry.id);
        if (error) throw error;
        toast.success('Entrada guardada');
      }
      queryClient.invalidateQueries({ queryKey: ['commercial-library'] });
      onOpenChange(false);
    } catch {
      toast.error('Não consegui guardar a entrada da biblioteca. Tenta novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const productId = await resolveProductId(entry.product);
      const { error } = await supabase.from('commercial_library_entries').insert({
        title: `${entry.title} (cópia)`,
        entry_type: entry.entry_type,
        product: entry.product,
        product_id: productId,
        project_id: entry.project_id,
        start_date: entry.start_date,
        end_date: entry.end_date,
        result: entry.result,
        summary: entry.summary,
        what_worked: entry.what_worked,
        what_didnt_work: entry.what_didnt_work,
        results_numbers: entry.results_numbers,
        learnings: entry.learnings,
        materials: entry.materials as any,
        notes: entry.notes,
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast.success('Entrada duplicada');
      queryClient.invalidateQueries({ queryKey: ['commercial-library'] });
      onOpenChange(false);
    } catch {
      toast.error('Erro ao duplicar');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!entry) return;
    const { error } = await supabase.from('commercial_library_entries').delete().eq('id', entry.id);
    if (error) { toast.error('Não consegui eliminar a entrada da biblioteca. Tenta novamente.'); return; }
    toast.success('Entrada eliminada');
    queryClient.invalidateQueries({ queryKey: ['commercial-library'] });
    onOpenChange(false);
  };

  const handleCreateContent = async () => {
    if (!entry?.id) { toast.error('Guarda a entrada primeiro'); return; }
    try {
      const productId = await resolveProductId(product);
      const { error } = await supabase.from('content_items').insert({
        title: `[Lançamento] ${title}`,
        status: 'em_ideia',
        product_name: product || null,
        product_id: productId,
        project_id: projectId || null,
        launch_id: entry.id,
        created_by: user?.id,
      } as any);
      if (error) throw error;
      toast.success('Conteúdo criado no calendário editorial');
      queryClient.invalidateQueries({ queryKey: ['launch-content', entry.id] });
      queryClient.invalidateQueries({ queryKey: ['content-items'] });
    } catch {
      toast.error('Erro ao criar conteúdo');
    }
  };

  const addMaterialLink = () => setMaterials([...materials, { label: '', url: '' }]);
  const updateMaterial = (idx: number, field: 'label' | 'url', val: string) => {
    const next = [...materials];
    next[idx] = { ...next[idx], [field]: val };
    setMaterials(next);
  };
  const removeMaterial = (idx: number) => setMaterials(materials.filter((_, i) => i !== idx));

  const isLaunchType = entryType === 'Lançamento' || entryType === 'Relançamento';

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{isNew ? 'Nova Entrada' : 'Editar Entrada'}</SheetTitle>
          </SheetHeader>

          <div className="space-y-6 mt-6">
            {/* Header fields */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label className="text-xs">Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome da estratégia ou campanha" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Tipo</Label>
                  <Select value={entryType} onValueChange={setEntryType}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ENTRY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Produto</Label>
                  <Select value={product} onValueChange={setProduct}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Nenhum</SelectItem>
                      {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Project selector */}
              <div className="space-y-2">
                <Label className="text-xs">Projeto associado (para cálculo de receita)</Label>
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Selecionar projeto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Nenhum</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Revenue badge */}
              {projectId && launchRevenue !== undefined && launchRevenue > 0 && (
                <div className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-success" />
                  <span className="text-sm font-medium">Receita total do lançamento:</span>
                  <Badge variant="outline" className="text-success dark:text-success border-success/30">
                    {launchRevenue.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}
                  </Badge>
                </div>
              )}

              {/* Past launches button */}
              {isLaunchType && pastLaunches.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => setPastLaunchesOpen(true)} className="gap-2">
                  <History className="h-3.5 w-3.5" />
                  Ver {pastLaunches.length} lançamento(s) anterior(es) deste produto
                </Button>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <DatePicker date={startDate} onChange={setStartDate} label="Data Início" />
                <DatePicker date={endDate} onChange={setEndDate} label="Data Fim" />
                <div className="space-y-2">
                  <Label className="text-xs">Resultado</Label>
                  <Select value={result} onValueChange={setResult}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {RESULTS.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {!isNew && entry?.updated_at && (
                <p className="text-xs text-muted-foreground">
                  Última atualização: {format(new Date(entry.updated_at), "d 'de' MMMM 'de' yyyy, HH:mm", { locale: pt })}
                </p>
              )}
            </div>

            <Separator />

            {/* Content sections */}
            <SectionField label="Resumo" hint="Descrição breve da estratégia ou campanha. O que foi feito e com que objetivo." value={summary} onChange={setSummary} />
            <SectionField label="O que funcionou" hint="Aspectos positivos, o que correu bem, o que pode ser replicado." value={whatWorked} onChange={setWhatWorked} />
            <SectionField label="O que não funcionou" hint="Obstáculos, erros, o que evitar." value={whatDidntWork} onChange={setWhatDidntWork} />
            <SectionField label="Resultados e Números" hint="Métricas relevantes: vendas geradas, leads, taxa de conversão, faturado, etc." value={resultsNumbers} onChange={setResultsNumbers} />
            <SectionField label="Aprendizagens" hint="Conclusões principais e o que aplicar nas próximas ações." value={learnings} onChange={setLearnings} />

            {/* Materials */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Materiais e Recursos</Label>
              <p className="text-xs text-muted-foreground">Links para copies, criativos, páginas de venda, emails, etc.</p>
              {materials.map((m, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input className="h-8 text-sm flex-1" placeholder="Nome" value={m.label} onChange={e => updateMaterial(idx, 'label', e.target.value)} />
                  <Input className="h-8 text-sm flex-[2]" placeholder="https://..." value={m.url} onChange={e => updateMaterial(idx, 'url', e.target.value)} />
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeMaterial(idx)}><X className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addMaterialLink}><Plus className="h-3.5 w-3.5 mr-1" /> Adicionar link</Button>
            </div>

            <SectionField label="Notas Adicionais" hint="Qualquer outra informação relevante." value={notes} onChange={setNotes} />

            <Separator />

            {/* Linked content items */}
            {!isNew && entry?.id && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold">Conteúdos do Lançamento</Label>
                  <Button variant="outline" size="sm" onClick={handleCreateContent} className="gap-2">
                    <FileText className="h-3.5 w-3.5" /> Criar conteúdo
                  </Button>
                </div>
                {linkedContent.length === 0 ? (
                  <EmptyHint>Nenhum conteúdo associado. Cria conteúdos para o calendário editorial.</EmptyHint>
                ) : (
                  <div className="space-y-2">
                    {linkedContent.map((c: any) => (
                      <Card key={c.id} className="p-0">
                        <CardContent className="p-3 flex items-center justify-between">
                          <span className="text-sm">{c.title}</span>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            {c.scheduled_at && <span>{format(new Date(c.scheduled_at), 'dd/MM/yyyy')}</span>}
                            <Badge variant="outline" className="text-xs">{c.status}</Badge>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            <Separator />

            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button onClick={handleSave} disabled={saving} variant="soft">
                <Check className="h-3.5 w-3.5 mr-1" /> {isNew ? 'Criar' : 'Guardar'}
              </Button>
              {!isNew && (
                <Button variant="outline" size="sm" onClick={handleDuplicate} disabled={saving}>
                  <Copy className="h-3.5 w-3.5 mr-1" /> Duplicar
                </Button>
              )}
              {!isNew && isOwner && (
                <Button variant="destructive" size="sm" onClick={handleDelete} className="ml-auto">
                  <Trash2 className="h-3.5 w-3.5 mr-1" /> Eliminar
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Past launches analysis dialog */}
      <PastLaunchesDialog
        open={pastLaunchesOpen}
        onOpenChange={setPastLaunchesOpen}
        productName={product}
        launches={pastLaunches}
      />

      {/* Auto-prompt for past launches */}
      <Dialog open={promptOpen} onOpenChange={setPromptOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Lançamentos anteriores encontrados</DialogTitle>
            <DialogDescription>
              Existem {pastLaunches.length} lançamento(s) registado(s) para "{product}". Queres analisar os resultados antes de avançar?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromptOpen(false)}>Não, continuar</Button>
            <Button variant="soft" onClick={() => { setPromptOpen(false); setPastLaunchesOpen(true); }}>
              <History className="h-3.5 w-3.5 mr-1" /> Ver lançamentos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SectionField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-semibold">{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <Textarea value={value} onChange={e => onChange(e.target.value)} className="min-h-[100px] text-sm" placeholder={`Escrever ${label.toLowerCase()}...`} />
    </div>
  );
}

function DatePicker({ date, onChange, label }: { date?: Date; onChange: (d: Date | undefined) => void; label: string }) {
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className={cn('w-full justify-start text-left font-normal h-9 text-sm', !date && 'text-muted-foreground')}>
            <CalendarIcon className="h-3.5 w-3.5 mr-2" />
            {date ? format(date, 'dd/MM/yyyy') : 'Selecionar'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={date} onSelect={onChange} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}
