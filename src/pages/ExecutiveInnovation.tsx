import { useState } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, BookOpen, Lightbulb, Link2, ExternalLink, ChevronRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/RichTextEditor';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';
import { EmptyHint } from '@/components/ui/loading-skeletons';
import { requireConfirm, confirmDestructive } from '@/lib/confirmDestructive';

const CONTEXTS = [
  { value: 'conteudos', label: 'Conteúdos' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'produto', label: 'Produto' },
  { value: 'operacao', label: 'Operação' },
  { value: 'comercial', label: 'Comercial' },
  { value: 'financeiro', label: 'Financeiro' },
  { value: 'equipa', label: 'Equipa' },
  { value: 'outro', label: 'Outro' },
];

const PLANS = [
  { value: 'curto', label: 'Curto Prazo' },
  { value: 'medio', label: 'Médio Prazo' },
  { value: 'longo', label: 'Longo Prazo' },
];

export default function ExecutiveInnovation() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Desenvolvimento & Inovação" subtitle="Aprendizagens, ideias e referências para o negócio" />

        <Tabs defaultValue="estudos">
          <TabsList>
            <TabsTrigger value="estudos" className="gap-2"><BookOpen className="h-3.5 w-3.5" /> Estudos & Formações</TabsTrigger>
            <TabsTrigger value="implementar" className="gap-2"><Lightbulb className="h-3.5 w-3.5" /> Implementar no Negócio</TabsTrigger>
            <TabsTrigger value="referencias" className="gap-2"><Link2 className="h-3.5 w-3.5" /> Banco de Referências</TabsTrigger>
          </TabsList>

          <TabsContent value="estudos">
            <TrainingCoursesTable />
          </TabsContent>

          <TabsContent value="implementar">
            <IdeasTable />
          </TabsContent>

          <TabsContent value="referencias">
            <DocEditor docKey="referencias" placeholder="Guarda referências, inspirações, links, exemplos..." />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

/* ─── Estudos & Formações ─── */

function TrainingCoursesTable() {
  const qc = useQueryClient();
  const [newName, setNewName] = useState('');
  const [newContract, setNewContract] = useState('');
  const [selectedCourse, setSelectedCourse] = useState<any>(null);

  const courses = useQuery({
    queryKey: ['training_courses'],
    queryFn: async () => {
      const { data } = await supabase.from('training_courses').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const addCourse = useMutation({
    mutationFn: async () => {
      if (!newName.trim()) return;
      await supabase.from('training_courses').insert({ name: newName.trim(), contract_url: newContract.trim() || null });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training_courses'] }); setNewName(''); setNewContract(''); toast.success('Formação adicionada'); },
  });

  const deleteCourse = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm(); await supabase.from('training_courses').delete().eq('id', id); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training_courses'] }); toast.success('Removida'); },
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Nome da formação</label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex: Curso de Marketing Digital" className="h-8 text-sm" onKeyDown={e => e.key === 'Enter' && addCourse.mutate()} />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Contrato (URL)</label>
              <Input value={newContract} onChange={e => setNewContract(e.target.value)} placeholder="https://..." className="h-8 text-sm" />
            </div>
            <Button size="sm" onClick={() => addCourse.mutate()} disabled={!newName.trim()} className="h-8"><Plus className="h-3 w-3 mr-1" /> Adicionar</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome da formação</TableHead>
                <TableHead className="w-32">Contrato</TableHead>
                <TableHead className="w-10"></TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(courses.data || []).length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">Sem formações registadas</TableCell></TableRow>
              ) : (courses.data || []).map((c: any) => (
                <TableRow key={c.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedCourse(c)}>
                  <TableCell className="text-sm font-medium">{c.name}</TableCell>
                  <TableCell>
                    {c.contract_url ? (
                      <a href={c.contract_url} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-primary hover:underline inline-flex items-center gap-1 text-xs">
                        <ExternalLink className="h-3 w-3" /> Ver
                      </a>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <button onClick={e => { e.stopPropagation(); deleteCourse.mutate(c.id); }} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </TableCell>
                  <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {selectedCourse && (
        <CourseDetailSheet course={selectedCourse} open onClose={() => setSelectedCourse(null)} />
      )}
    </div>
  );
}

/* ─── Course Detail Sheet (Dúvidas) ─── */

function CourseDetailSheet({ course, open, onClose }: { course: any; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [newDoubt, setNewDoubt] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  const doubts = useQuery({
    queryKey: ['training_doubts', course.id],
    queryFn: async () => {
      const { data } = await supabase.from('training_doubts').select('*').eq('course_id', course.id).order('doubt_date', { ascending: false });
      return data || [];
    },
  });

  const addDoubt = useMutation({
    mutationFn: async () => {
      if (!newDoubt.trim()) return;
      await supabase.from('training_doubts').insert({ course_id: course.id, doubt: newDoubt.trim(), doubt_date: newDate });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training_doubts', course.id] }); setNewDoubt(''); toast.success('Dúvida adicionada'); },
  });

  const deleteDoubt = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm(); await supabase.from('training_doubts').delete().eq('id', id); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['training_doubts', course.id] }),
  });

  // Group doubts by date
  const groupedByDate = (doubts.data || []).reduce((acc: Record<string, any[]>, d: any) => {
    const key = d.doubt_date;
    if (!acc[key]) acc[key] = [];
    acc[key].push(d);
    return acc;
  }, {});

  const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-lg">{course.name}</SheetTitle>
          {course.contract_url && (
            <a href={course.contract_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
              <ExternalLink className="h-3 w-3" /> Ver contrato
            </a>
          )}
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Add doubt */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold">Adicionar dúvida</h3>
            <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-8 text-sm w-40" />
            <Textarea value={newDoubt} onChange={e => setNewDoubt(e.target.value)} placeholder="Escreve a dúvida..." className="min-h-[60px] text-sm" />
            <Button size="sm" onClick={() => addDoubt.mutate()} disabled={!newDoubt.trim()} className="gap-2">
              <Plus className="h-3 w-3" /> Adicionar
            </Button>
          </div>

          {/* Doubts grouped by date */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Dúvidas</h3>
            {sortedDates.length === 0 ? (
              <EmptyHint>Sem dúvidas registadas</EmptyHint>
            ) : sortedDates.map(date => (
              <Card key={date}>
                <CardContent className="p-4 space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {format(new Date(date + 'T00:00:00'), "d 'de' MMMM yyyy", { locale: pt })}
                  </p>
                  <ul className="space-y-2">
                    {groupedByDate[date].map((d: any) => (
                      <li key={d.id} className="flex items-start gap-2 group text-sm">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                        <span className="flex-1">{d.doubt}</span>
                        <button onClick={() => deleteDoubt.mutate(d.id)} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                          <Trash2 className="h-3 w-3 text-muted-foreground hover:text-destructive" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── DocEditor (unchanged) ─── */

function DocEditor({ docKey, placeholder }: { docKey: string; placeholder: string }) {
  const qc = useQueryClient();

  const doc = useQuery({
    queryKey: ['innovation_docs', docKey],
    queryFn: async () => {
      const { data } = await supabase.from('innovation_docs').select('*').eq('doc_key', docKey).maybeSingle();
      return data;
    },
  });

  const save = useMutation({
    mutationFn: async (content: string) => {
      if (doc.data?.id) {
        await supabase.from('innovation_docs').update({ content, updated_at: new Date().toISOString() }).eq('id', doc.data.id);
      } else {
        await supabase.from('innovation_docs').insert({ doc_key: docKey, content });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['innovation_docs', docKey] }),
  });

  if (doc.isLoading) return <div className="py-8 text-center text-sm text-muted-foreground">A carregar...</div>;

  return (
    <Card>
      <CardContent className="p-4">
        <RichTextEditor
          content={doc.data?.content || ''}
          onChange={(html) => save.mutate(html)}
        />
      </CardContent>
    </Card>
  );
}

/* ─── IdeasTable (unchanged) ─── */

function IdeasTable() {
  const qc = useQueryClient();
  const [newIdea, setNewIdea] = useState('');
  const [newContext, setNewContext] = useState('outro');
  const [newPlan, setNewPlan] = useState('curto');

  const ideas = useQuery({
    queryKey: ['innovation_ideas'],
    queryFn: async () => {
      const { data } = await supabase.from('innovation_ideas').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const addIdea = useMutation({
    mutationFn: async () => {
      if (!newIdea.trim()) return;
      await supabase.from('innovation_ideas').insert({ idea: newIdea.trim(), context: newContext, plan: newPlan });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['innovation_ideas'] }); setNewIdea(''); toast.success('Ideia adicionada'); },
  });

  const toggleCompleted = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const updates: any = { completed };
      if (completed) updates.implementation_date = new Date().toISOString().split('T')[0];
      else updates.implementation_date = null;
      await supabase.from('innovation_ideas').update(updates).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['innovation_ideas'] }),
  });

  const updateField = useMutation({
    mutationFn: async ({ id, field, value }: { id: string; field: string; value: any }) => {
      await supabase.from('innovation_ideas').update({ [field]: value } as any).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['innovation_ideas'] }),
  });

  const deleteIdea = useMutation({
    mutationFn: async (id: string) => {
      await requireConfirm();
      await supabase.from('innovation_ideas').delete().eq('id', id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['innovation_ideas'] }); toast.success('Removida'); },
  });

  const contextLabel = (v: string) => CONTEXTS.find(c => c.value === v)?.label || v;
  const planLabel = (v: string) => PLANS.find(p => p.value === v)?.label || v;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2 items-end flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Ideia</label>
              <Input value={newIdea} onChange={e => setNewIdea(e.target.value)} placeholder="Descreve a ideia..." className="h-8 text-sm" onKeyDown={e => e.key === 'Enter' && addIdea.mutate()} />
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Contexto</label>
              <Select value={newContext} onValueChange={setNewContext}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{CONTEXTS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Plano</label>
              <Select value={newPlan} onValueChange={setNewPlan}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>{PLANS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" onClick={() => addIdea.mutate()} className="h-8"><Plus className="h-3 w-3 mr-1" /> Nova Ideia</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Ideia</TableHead>
                <TableHead className="w-32">Contexto</TableHead>
                <TableHead className="w-32">Plano</TableHead>
                <TableHead className="w-28">Criação</TableHead>
                <TableHead className="w-28">Implementação</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(ideas.data || []).length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Sem ideias registadas</TableCell></TableRow>
              ) : (ideas.data || []).map((idea: any) => (
                <TableRow key={idea.id} className={idea.completed ? 'opacity-60' : ''}>
                  <TableCell>
                    <Checkbox checked={idea.completed} onCheckedChange={(v) => toggleCompleted.mutate({ id: idea.id, completed: !!v })} />
                  </TableCell>
                  <TableCell className={`text-sm ${idea.completed ? 'line-through' : ''}`}>{idea.idea}</TableCell>
                  <TableCell>
                    <Select value={idea.context} onValueChange={(v) => updateField.mutate({ id: idea.id, field: 'context', value: v })}>
                      <SelectTrigger className="h-7 text-xs border-none shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent>{CONTEXTS.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Select value={idea.plan} onValueChange={(v) => updateField.mutate({ id: idea.id, field: 'plan', value: v })}>
                      <SelectTrigger className="h-7 text-xs border-none shadow-none"><SelectValue /></SelectTrigger>
                      <SelectContent>{PLANS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{format(new Date(idea.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-muted-foreground">{idea.implementation_date ? format(new Date(idea.implementation_date), 'dd/MM/yyyy') : '—'}</TableCell>
                  <TableCell>
                    <button onClick={() => deleteIdea.mutate(idea.id)} className="text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
