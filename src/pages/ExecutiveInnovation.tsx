import { useState } from 'react';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, BookOpen, Lightbulb, Link2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { RichTextEditor } from '@/components/RichTextEditor';
import { format } from 'date-fns';

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
        <PageHeader title="Desenvolvimento & Inovação" subtitle="Aprendizagens, ideias e referências para o negócio" />

        <Tabs defaultValue="estudos">
          <TabsList>
            <TabsTrigger value="estudos" className="gap-1.5"><BookOpen className="h-3.5 w-3.5" /> Estudos & Formações</TabsTrigger>
            <TabsTrigger value="implementar" className="gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Implementar no Negócio</TabsTrigger>
            <TabsTrigger value="referencias" className="gap-1.5"><Link2 className="h-3.5 w-3.5" /> Banco de Referências</TabsTrigger>
          </TabsList>

          <TabsContent value="estudos">
            <DocEditor docKey="estudos" placeholder="Regista formações em curso, livros, cursos, aprendizagens..." />
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
      await supabase.from('innovation_ideas').update({ [field]: value }).eq('id', id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['innovation_ideas'] }),
  });

  const deleteIdea = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('innovation_ideas').delete().eq('id', id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['innovation_ideas'] }); toast.success('Removida'); },
  });

  const contextLabel = (v: string) => CONTEXTS.find(c => c.value === v)?.label || v;
  const planLabel = (v: string) => PLANS.find(p => p.value === v)?.label || v;

  return (
    <div className="space-y-4">
      {/* Add new idea */}
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

      {/* Ideas table */}
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
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(idea.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{idea.implementation_date ? format(new Date(idea.implementation_date), 'dd/MM/yyyy') : '—'}</TableCell>
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
