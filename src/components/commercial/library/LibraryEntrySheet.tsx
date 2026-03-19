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
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { CalendarIcon, Check, Copy, Trash2, Upload, ExternalLink, X } from 'lucide-react';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const ENTRY_TYPES = ['Lançamento', 'Relançamento', 'Campanha', 'Sequência de Email', 'Promoção', 'Outro'];
const RESULTS = ['Funcionou', 'Não Funcionou', 'Parcialmente'];

interface MaterialLink {
  label: string;
  url: string;
}

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

  useEffect(() => {
    if (entry && !isNew) {
      setTitle(entry.title || '');
      setEntryType(entry.entry_type || 'Outro');
      setProduct(entry.product || '');
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
    } else if (isNew) {
      setTitle('');
      setEntryType('Outro');
      setProduct('');
      setStartDate(undefined);
      setEndDate(undefined);
      setResult('Parcialmente');
      setSummary('');
      setWhatWorked('');
      setWhatDidntWork('');
      setResultsNumbers('');
      setLearnings('');
      setMaterials([]);
      setNotes('');
    }
  }, [entry, isNew, open]);

  const handleSave = async () => {
    if (!title.trim()) { toast.error('O título é obrigatório'); return; }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        entry_type: entryType,
        product: product || null,
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
      toast.error('Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleDuplicate = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('commercial_library_entries').insert({
        title: `${entry.title} (cópia)`,
        entry_type: entry.entry_type,
        product: entry.product,
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
    if (error) { toast.error('Erro ao eliminar'); return; }
    toast.success('Entrada eliminada');
    queryClient.invalidateQueries({ queryKey: ['commercial-library'] });
    onOpenChange(false);
  };

  const addMaterialLink = () => setMaterials([...materials, { label: '', url: '' }]);
  const updateMaterial = (idx: number, field: 'label' | 'url', val: string) => {
    const next = [...materials];
    next[idx] = { ...next[idx], [field]: val };
    setMaterials(next);
  };
  const removeMaterial = (idx: number) => setMaterials(materials.filter((_, i) => i !== idx));

  const DatePicker = ({ date, onChange, label }: { date?: Date; onChange: (d: Date | undefined) => void; label: string }) => (
    <div className="space-y-1.5">
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isNew ? 'Nova Entrada' : 'Editar Entrada'}</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Header fields */}
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Título</Label>
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Nome da estratégia ou campanha" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo</Label>
                <Select value={entryType} onValueChange={setEntryType}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENTRY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
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

            <div className="grid grid-cols-3 gap-3">
              <DatePicker date={startDate} onChange={setStartDate} label="Data Início" />
              <DatePicker date={endDate} onChange={setEndDate} label="Data Fim" />
              <div className="space-y-1.5">
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

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving}>
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
  );
}

function SectionField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      <Textarea value={value} onChange={e => onChange(e.target.value)} className="min-h-[100px] text-sm" placeholder={`Escrever ${label.toLowerCase()}...`} />
    </div>
  );
}
