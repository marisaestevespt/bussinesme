import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, FileText, List, RotateCw } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { BackNavigation } from '@/components/BackNavigation';
import { usePlanningRoutines } from '@/hooks/usePlanningRoutines';

const DEPT = 'marketing';

const SOP_STATUSES = [
  { value: 'para_criar', label: 'Para criar', color: 'bg-muted text-muted-foreground' },
  { value: 'em_criacao', label: 'Em criação', color: 'bg-amber-100 text-amber-800 border-amber-200' },
  { value: 'ativo', label: 'Ativo', color: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  { value: 'em_revisao', label: 'Em revisão', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'off', label: 'Off', color: 'bg-red-100 text-red-800 border-red-200' },
];

function getStatusInfo(status: string) {
  return SOP_STATUSES.find(s => s.value === status) || SOP_STATUSES[0];
}

export default function MarketingProcessos() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const planningRoutines = usePlanningRoutines();

  const [activeTab, setActiveTab] = useState('galeria');
  const [showNewSop, setShowNewSop] = useState(false);
  const [newSopName, setNewSopName] = useState('');
  const [newSopStatus, setNewSopStatus] = useState('para_criar');

  // Routine dialog state
  const [showNewRoutineDialog, setShowNewRoutineDialog] = useState(false);
  const [prTitle, setPrTitle] = useState('');
  const [prResponsible, setPrResponsible] = useState('');
  const [prRecurrence, setPrRecurrence] = useState<'semanal' | 'mensal'>('semanal');
  const [prWeekday, setPrWeekday] = useState('1');
  const [prMonthDay, setPrMonthDay] = useState('1');
  const [prAdjustBiz, setPrAdjustBiz] = useState(true);

  const { data: sops = [] } = useQuery({
    queryKey: ['sops'],
    queryFn: async () => {
      const { data } = await supabase.from('sops').select('*').order('sop_id');
      return data || [];
    },
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['team_members'],
    queryFn: async () => {
      const { data } = await supabase.from('team_members').select('id, full_name, role_title, profile_id, photo_url').eq('status', 'ativo').order('full_name');
      return data || [];
    },
  });

  const mktSops = sops.filter(s => s.department === DEPT);
  const routinesData = planningRoutines.routines.data || [];

  const sortedSops = [...mktSops].sort((a, b) => {
    const numA = parseInt(a.sop_id?.replace('SOP-', '') || '0');
    const numB = parseInt(b.sop_id?.replace('SOP-', '') || '0');
    return numA - numB;
  });

  const createSop = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('sops').insert({
        name: newSopName, department: DEPT, status: newSopStatus, created_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sops'] }); setShowNewSop(false); setNewSopName(''); toast.success('Processo criado'); },
    onError: () => toast.error('Erro ao criar processo'),
  });

  function resetRoutineDialog() {
    setPrTitle(''); setPrResponsible(''); setPrRecurrence('semanal'); setPrWeekday('1'); setPrMonthDay('1'); setPrAdjustBiz(true);
  }

  return (
    <AppLayout>
      <div className="flex flex-col min-h-screen">
        <PageHeader title="Processos de Marketing" subtitle="Marketing 360" />

        <div className="max-w-6xl mx-auto w-full px-4 py-8 space-y-6">
          <div className="flex items-center justify-between">
            <BackNavigation parentRoute="/hub/marketing" parentLabel="Marketing" />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowNewRoutineDialog(true)}>
                <Plus className="h-4 w-4 mr-1" />Nova Rotina
              </Button>
              <Button size="sm" onClick={() => setShowNewSop(true)}>
                <Plus className="h-4 w-4 mr-1" />Novo Processo
              </Button>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="galeria"><FileText className="h-4 w-4 mr-1" />Galeria</TabsTrigger>
              <TabsTrigger value="lista"><List className="h-4 w-4 mr-1" />Lista</TabsTrigger>
            </TabsList>

            {/* Galeria */}
            <TabsContent value="galeria" className="space-y-8 mt-6">
              {/* SOPs */}
              <section>
                <h2 className="text-xl font-bold tracking-tight mb-4">SOPs ({mktSops.length})</h2>
                {mktSops.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhum processo de marketing criado.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {sortedSops.map(sop => {
                      const st = getStatusInfo(sop.status);
                      return (
                        <Card key={sop.id} className="cursor-pointer hover:shadow-md hq-transition" onClick={() => navigate(`/hub/processos/${sop.id}`)}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-mono text-muted-foreground">{sop.sop_id}</span>
                              <Badge className={cn('text-xs', st.color)}>{st.label}</Badge>
                            </div>
                            <div className="flex items-start gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                              <p className="font-medium text-sm line-clamp-2">{sop.name}</p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Rotinas */}
              <section>
                <h2 className="text-xl font-bold tracking-tight mb-4 flex items-center gap-2">
                  <RotateCw className="h-4 w-4 text-primary" /> Rotinas ({routinesData.length})
                </h2>
                {routinesData.length === 0 ? (
                  <p className="text-muted-foreground text-sm">Nenhuma rotina configurada.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {routinesData.map((pr: any) => {
                      const assignee = pr.profiles;
                      const hourLabel = pr.hour_time ? ` às ${pr.hour_time.slice(0, 5)}` : '';
                      const recLabel = pr.recurrence_type === 'semanal'
                        ? `Semanal — ${['', '2ª', '3ª', '4ª', '5ª', '6ª', 'Sáb', 'Dom'][pr.weekday || 0]} feira${hourLabel}`
                        : `Mensal — dia ${pr.month_day}${hourLabel}${pr.adjust_to_business_day ? ' (ajuste dia útil)' : ''}`;
                      return (
                        <Card key={pr.id} className="p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium line-clamp-2">{pr.title}</p>
                              <p className="text-xs text-muted-foreground mt-1">{recLabel}</p>
                              <Badge variant={pr.active ? 'default' : 'secondary'} className="text-[10px] mt-1">
                                {pr.active ? 'Ativa' : 'Inativa'}
                              </Badge>
                            </div>
                            <div className="flex flex-col gap-1 items-end shrink-0">
                              <Switch
                                checked={pr.active}
                                onCheckedChange={(v) => planningRoutines.toggleActive.mutate({ id: pr.id, active: v })}
                                className="scale-75"
                              />
                              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => planningRoutines.deleteRoutine.mutate(pr.id)}>
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                          {assignee && (
                            <div className="flex items-center gap-1.5 mt-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={assignee.avatar_url || ''} />
                                <AvatarFallback className="text-[10px]">{(assignee.full_name || '?')[0]}</AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-muted-foreground truncate">{assignee.full_name}</span>
                            </div>
                          )}
                        </Card>
                      );
                    })}
                  </div>
                )}
              </section>
            </TabsContent>

            {/* Lista */}
            <TabsContent value="lista" className="mt-6">
              <h2 className="text-xl font-bold tracking-tight mb-4">Lista de SOPs — Marketing</h2>
              {sortedSops.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum SOP de marketing.</p>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Nº SOP</TableHead>
                        <TableHead>Nome</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sortedSops.map(sop => {
                        const st = getStatusInfo(sop.status);
                        return (
                          <TableRow key={sop.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/hub/processos/${sop.id}`)}>
                            <TableCell className="font-mono text-sm">{sop.sop_id}</TableCell>
                            <TableCell className="font-medium">{sop.name}</TableCell>
                            <TableCell><Badge className={cn('text-xs', st.color)}>{st.label}</Badge></TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialog: Novo SOP */}
      <Dialog open={showNewSop} onOpenChange={setShowNewSop}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo Processo (SOP)</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={newSopName} onChange={e => setNewSopName(e.target.value)} placeholder="Ex: Criação de conteúdo" /></div>
            <div>
              <Label>Status</Label>
              <Select value={newSopStatus} onValueChange={setNewSopStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SOP_STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button className="w-full" disabled={!newSopName.trim()} onClick={() => createSop.mutate()}>Criar Processo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Rotina */}
      <Dialog open={showNewRoutineDialog} onOpenChange={v => { if (!v) { setShowNewRoutineDialog(false); resetRoutineDialog(); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Nova Rotina</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={prTitle} onChange={e => setPrTitle(e.target.value)} placeholder="Ex: Publicar stories" />
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={prResponsible} onValueChange={setPrResponsible}>
                <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.id} value={m.profile_id || m.id}>
                      {m.full_name}{m.role_title ? ` — ${m.role_title}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de recorrência</Label>
              <Select value={prRecurrence} onValueChange={v => setPrRecurrence(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {prRecurrence === 'semanal' && (
              <div>
                <Label>Dia da semana</Label>
                <Select value={prWeekday} onValueChange={setPrWeekday}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Segunda-feira</SelectItem>
                    <SelectItem value="2">Terça-feira</SelectItem>
                    <SelectItem value="3">Quarta-feira</SelectItem>
                    <SelectItem value="4">Quinta-feira</SelectItem>
                    <SelectItem value="5">Sexta-feira</SelectItem>
                    <SelectItem value="6">Sábado</SelectItem>
                    <SelectItem value="7">Domingo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {prRecurrence === 'mensal' && (
              <>
                <div>
                  <Label>Dia do mês</Label>
                  <Input type="number" min={1} max={31} value={prMonthDay} onChange={e => setPrMonthDay(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={prAdjustBiz} onCheckedChange={setPrAdjustBiz} />
                  <Label className="text-sm">Ajustar para dia útil anterior</Label>
                </div>
              </>
            )}
            <Button
              className="w-full"
              disabled={!prTitle.trim() || planningRoutines.createRoutine.isPending}
              onClick={() => {
                planningRoutines.createRoutine.mutate({
                  title: prTitle,
                  responsible: prResponsible || null,
                  recurrence_type: prRecurrence,
                  weekday: prRecurrence === 'semanal' ? Number(prWeekday) : null,
                  month_day: prRecurrence === 'mensal' ? Number(prMonthDay) : null,
                  adjust_to_business_day: prRecurrence === 'mensal' ? prAdjustBiz : true,
                  created_by: user?.id,
                }, {
                  onSuccess: () => { setShowNewRoutineDialog(false); resetRoutineDialog(); },
                });
              }}
            >
              {planningRoutines.createRoutine.isPending ? 'A criar...' : 'Criar Rotina'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
