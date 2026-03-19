import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';
import { Users, GitBranch, FileText, Plus, ExternalLink, Mail, Phone, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTeamData, MEMBER_STATUSES, MEMBER_TYPES, labelFor } from '@/hooks/useTeamData';
import { toast } from 'sonner';
import { format } from 'date-fns';

const DOC_TYPES = [
  { value: 'guia_cultura', label: 'Guia de Cultura' },
  { value: 'codigo_conduta', label: 'Código de Conduta' },
  { value: 'politica_comunicacao', label: 'Política de Comunicação' },
  { value: 'politica_tarefas', label: 'Política de Gestão de Tarefas' },
  { value: 'politica_confidencialidade', label: 'Política de Confidencialidade' },
  { value: 'glossario', label: 'Glossário Interno' },
  { value: 'outro', label: 'Outro' },
];

const DOC_STATUSES = [
  { value: 'ativo', label: 'Ativo' },
  { value: 'em_revisao', label: 'Em revisão' },
  { value: 'arquivo', label: 'Arquivo' },
];

const SOP_STATUSES: Record<string, { label: string; color: string }> = {
  fechado: { label: 'Fechado', color: 'bg-green-100 text-green-800' },
  em_ideia: { label: 'Em ideia', color: 'bg-amber-100 text-amber-800' },
};

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    ativo: { label: 'Ativo', variant: 'default' },
    inativo: { label: 'Inativo', variant: 'secondary' },
    prestador: { label: 'Prestador', variant: 'outline' },
  };
  const s = map[status] || { label: status, variant: 'secondary' as const };
  return <Badge variant={s.variant} className="text-[10px]">{s.label}</Badge>;
}

export default function HubEquipaPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <PageHeader title="Equipa" subtitle="Membros, processos e documentos internos" />

        <Tabs defaultValue="membros">
          <TabsList>
            <TabsTrigger value="membros" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Membros</TabsTrigger>
            <TabsTrigger value="processos" className="gap-1.5"><GitBranch className="h-3.5 w-3.5" /> Processos & SOPs</TabsTrigger>
            <TabsTrigger value="documentos" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Documentos Internos</TabsTrigger>
          </TabsList>

          <TabsContent value="membros"><MembrosTab /></TabsContent>
          <TabsContent value="processos"><ProcessosTab /></TabsContent>
          <TabsContent value="documentos"><DocumentosTab /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

/* ─── TAB 1: MEMBROS ─── */
function MembrosTab() {
  const navigate = useNavigate();
  const team = useTeamData();
  const [selectedMember, setSelectedMember] = useState<any>(null);

  const activeMembers = useMemo(() =>
    (team.members.data || []).filter((m: any) => m.status === 'ativo' || m.status === 'prestador'),
    [team.members.data]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{activeMembers.length} membro(s) ativo(s)</p>
        <Button size="sm" onClick={() => navigate('/executive/gestao-equipa')}>
          <Plus className="h-3 w-3 mr-1" /> Novo Membro
        </Button>
      </div>

      {/* Member Gallery */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeMembers.map((m: any) => (
          <Card key={m.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedMember(m)}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{getInitials(m.full_name)}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold truncate">{m.full_name}</h3>
                    {statusBadge(m.status)}
                  </div>
                  {m.role_title && <p className="text-xs text-muted-foreground mt-0.5">{m.role_title}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    {m.email && (
                      <a href={`mailto:${m.email}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary">
                        <Mail className="h-3 w-3" /> {m.email}
                      </a>
                    )}
                  </div>
                  {m.whatsapp && (
                    <a href={`https://wa.me/${m.whatsapp.replace(/\D/g, '')}`} onClick={e => e.stopPropagation()} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary mt-1">
                      <Phone className="h-3 w-3" /> {m.whatsapp}
                    </a>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {activeMembers.length === 0 && (
          <Card className="col-span-full">
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              Sem membros ativos. <button onClick={() => navigate('/executive/gestao-equipa')} className="text-primary underline">Adicionar na Gestão de Equipa</button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Member Detail Sheet */}
      <Sheet open={!!selectedMember} onOpenChange={v => !v && setSelectedMember(null)}>
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          {selectedMember && (
            <>
              <SheetHeader>
                <SheetTitle>{selectedMember.full_name}</SheetTitle>
              </SheetHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div><span className="text-xs text-muted-foreground block">Função</span>{selectedMember.role_title || '—'}</div>
                  <div><span className="text-xs text-muted-foreground block">Status</span>{labelFor(MEMBER_STATUSES, selectedMember.status)}</div>
                  <div><span className="text-xs text-muted-foreground block">Tipo</span>{labelFor(MEMBER_TYPES, selectedMember.member_type)}</div>
                  <div><span className="text-xs text-muted-foreground block">Data de início</span>{selectedMember.start_date || '—'}</div>
                  <div><span className="text-xs text-muted-foreground block">Email</span>{selectedMember.email || '—'}</div>
                  <div><span className="text-xs text-muted-foreground block">Whatsapp</span>{selectedMember.whatsapp || '—'}</div>
                  <div className="col-span-2"><span className="text-xs text-muted-foreground block">Horário</span>{selectedMember.work_schedule || '—'}</div>
                </div>
                <Separator />
                {selectedMember.presentation && (
                  <div><span className="text-xs text-muted-foreground block mb-1">Apresentação</span><p className="text-sm">{selectedMember.presentation}</p></div>
                )}
                {selectedMember.responsibilities && (
                  <div><span className="text-xs text-muted-foreground block mb-1">Responsabilidades</span><p className="text-sm whitespace-pre-wrap">{selectedMember.responsibilities}</p></div>
                )}
                <Separator />
                <Button variant="outline" size="sm" className="w-full" onClick={() => { setSelectedMember(null); navigate('/executive/gestao-equipa'); }}>
                  <ExternalLink className="h-3 w-3 mr-1" /> Abrir na Gestão de Equipa
                </Button>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Digital Desk */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Digital Desk</h3>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {activeMembers.map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div>
                <p className="text-sm font-medium">{m.full_name}</p>
                <p className="text-xs text-muted-foreground">{m.role_title || '—'}</p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => navigate('/secretaria')}>
                Abrir Desk <ExternalLink className="h-3 w-3 ml-1" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── TAB 2: PROCESSOS & SOPs ─── */
function ProcessosTab() {
  const navigate = useNavigate();
  const [filterDept, setFilterDept] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const sops = useQuery({
    queryKey: ['sops_list'],
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('*').order('updated_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  const departments = useMemo(() => {
    const depts = new Set((sops.data || []).map((s: any) => s.department).filter(Boolean));
    return Array.from(depts) as string[];
  }, [sops.data]);

  const filtered = useMemo(() => {
    let result = sops.data || [];
    if (filterDept) result = result.filter((s: any) => s.department === filterDept);
    if (filterStatus) result = result.filter((s: any) => s.status === filterStatus);
    return result;
  }, [sops.data, filterDept, filterStatus]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-2">
          <Select value={filterDept || 'all'} onValueChange={v => setFilterDept(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-40 text-sm"><SelectValue placeholder="Departamento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os departamentos</SelectItem>
              {departments.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterStatus || 'all'} onValueChange={v => setFilterStatus(v === 'all' ? '' : v)}>
            <SelectTrigger className="h-8 w-32 text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="fechado">Fechado</SelectItem>
              <SelectItem value="em_ideia">Em ideia</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => navigate('/hub/processos')}>
          <Plus className="h-3 w-3 mr-1" /> Novo SOP
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-24">ID</TableHead>
                <TableHead>Processo</TableHead>
                <TableHead>Área / Departamento</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32">Última atualização</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Sem processos registados</TableCell></TableRow>
              ) : filtered.map((s: any) => {
                const st = SOP_STATUSES[s.status] || { label: s.status, color: 'bg-muted text-muted-foreground' };
                return (
                  <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/processos/${s.id}`)}>
                    <TableCell className="text-xs font-mono text-muted-foreground">{s.sop_id}</TableCell>
                    <TableCell className="text-sm font-medium">{s.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.department || '—'}</TableCell>
                    <TableCell><Badge className={`${st.color} border-none text-[10px]`}>{st.label}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{s.updated_at ? format(new Date(s.updated_at), 'dd/MM/yyyy') : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── TAB 3: DOCUMENTOS INTERNOS ─── */
function DocumentosTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const team = useTeamData();
  const members = team.members.data || [];

  const docs = useQuery({
    queryKey: ['internal_documents'],
    queryFn: async () => {
      const { data } = await supabase.from('internal_documents').select('*').order('doc_type').order('created_at', { ascending: false });
      return (data || []) as any[];
    },
  });

  // New doc state
  const [f, setF] = useState({
    title: '', doc_type: 'outro', version: 'v1.0', responsible_id: '', status: 'ativo', file_url: '', notes: '',
  });
  const set = (k: string, v: string) => setF(prev => ({ ...prev, [k]: v }));

  const addDoc = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('internal_documents').insert({
        title: f.title,
        doc_type: f.doc_type,
        category: f.doc_type,
        version: f.version,
        responsible_id: f.responsible_id || null,
        status: f.status,
        file_url: f.file_url || null,
        notes: f.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['internal_documents'] });
      toast.success('Documento adicionado');
      setDialogOpen(false);
      setF({ title: '', doc_type: 'outro', version: 'v1.0', responsible_id: '', status: 'ativo', file_url: '', notes: '' });
    },
    onError: () => toast.error('Erro ao guardar'),
  });

  const deleteDoc = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from('internal_documents').delete().eq('id', id);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['internal_documents'] }); toast.success('Removido'); },
  });

  const docTypeLabel = (v: string) => DOC_TYPES.find(d => d.value === v)?.label || v;
  const docStatusLabel = (v: string) => DOC_STATUSES.find(d => d.value === v)?.label || v;
  const memberName = (id: string) => members.find((m: any) => m.id === id)?.full_name || '—';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-3 w-3 mr-1" /> Novo Documento</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Documento Interno</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Título *" value={f.title} onChange={e => set('title', e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Tipo</label>
                  <Select value={f.doc_type} onValueChange={v => set('doc_type', v)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{DOC_TYPES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Versão</label>
                  <Input value={f.version} onChange={e => set('version', e.target.value)} placeholder="v1.0" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground">Responsável</label>
                  <Select value={f.responsible_id || '_none'} onValueChange={v => set('responsible_id', v === '_none' ? '' : v)}>
                    <SelectTrigger className="text-sm"><SelectValue placeholder="Selecionar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">—</SelectItem>
                      {members.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status</label>
                  <Select value={f.status} onValueChange={v => set('status', v)}>
                    <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{DOC_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Link do documento</label>
                <Input placeholder="https://..." value={f.file_url} onChange={e => set('file_url', e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Notas</label>
                <Textarea value={f.notes} onChange={e => set('notes', e.target.value)} rows={2} />
              </div>
              <Button className="w-full" onClick={() => addDoc.mutate()} disabled={!f.title.trim()}>Guardar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="w-20">Versão</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead className="w-24">Status</TableHead>
                <TableHead className="w-28">Criação</TableHead>
                <TableHead className="w-28">Atualização</TableHead>
                <TableHead className="w-8"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(docs.data || []).length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-8">Sem documentos internos</TableCell></TableRow>
              ) : (docs.data || []).map((d: any) => (
                <TableRow key={d.id}>
                  <TableCell className="text-sm font-medium">
                    {d.file_url ? (
                      <a href={d.file_url} target="_blank" rel="noreferrer" className="hover:text-primary underline-offset-2 hover:underline flex items-center gap-1">
                        {d.title} <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : d.title}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{docTypeLabel(d.doc_type || d.category)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{d.version || '—'}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.responsible_id ? memberName(d.responsible_id) : '—'}</TableCell>
                  <TableCell>
                    <Badge variant={d.status === 'ativo' ? 'default' : d.status === 'em_revisao' ? 'secondary' : 'outline'} className="text-[10px]">
                      {docStatusLabel(d.status)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(d.created_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(d.updated_at), 'dd/MM/yyyy')}</TableCell>
                  <TableCell>
                    <button onClick={() => deleteDoc.mutate(d.id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
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
