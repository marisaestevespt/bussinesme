import { useState } from 'react';
import { BackNavigation } from '@/components/BackNavigation';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MentionTextarea } from '@/components/MentionTextarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Eye, EyeOff, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ui/confirm-dialog';

const PLATFORM_TYPES = [
  { value: 'gestao', label: 'Gestão', color: 'bg-info/15 text-info' },
  { value: 'crm', label: 'CRM', color: 'bg-purple-100 text-purple-800' },
  { value: 'redes_sociais', label: 'Redes Sociais', color: 'bg-pink-100 text-pink-800' },
  { value: 'email_marketing', label: 'Email Marketing', color: 'bg-warning/15 text-warning' },
  { value: 'checkout', label: 'Checkout', color: 'bg-success/15 text-success' },
  { value: 'dominio', label: 'Domínio', color: 'bg-teal-100 text-teal-800' },
  { value: 'alojamento', label: 'Alojamento', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'automacoes', label: 'Automações', color: 'bg-warning/15 text-warning' },
  { value: 'integracoes', label: 'Integrações', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'contabilidade', label: 'Contabilidade', color: 'bg-slate-100 text-slate-800' },
  { value: 'outros', label: 'Outros', color: 'bg-gray-100 text-gray-800' },
] as const;

function getTypeInfo(value: string) {
  return PLATFORM_TYPES.find(t => t.value === value) || PLATFORM_TYPES[PLATFORM_TYPES.length - 1];
}

interface PlatformAccess {
  id: string;
  platform_name: string;
  username_email: string;
  encrypted_password: string;
  platform_type: string;
  direct_link: string | null;
  notes: string | null;
  created_at: string;
}

async function invokeAccessFn(action: string, body: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado');

  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-access-password`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
      },
      body: JSON.stringify({ action, ...body }),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Erro na operação');
  return json;
}

export default function AcessosPage() {
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});
  const [revealingId, setRevealingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formType, setFormType] = useState('outros');
  const [formLink, setFormLink] = useState('');
  const [formNotes, setFormNotes] = useState('');

  const { data: accesses = [], isLoading } = useQuery({
    queryKey: ['platform-accesses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_accesses')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as PlatformAccess[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => invokeAccessFn('encrypt', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-accesses'] });
      toast.success('Acesso criado');
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => invokeAccessFn('update', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-accesses'] });
      toast.success('Acesso atualizado');
      resetForm();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('platform_accesses').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-accesses'] });
      toast.success('Acesso eliminado');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function resetForm() {
    setFormName('');
    setFormUsername('');
    setFormPassword('');
    setFormType('outros');
    setFormLink('');
    setFormNotes('');
    setEditingId(null);
    setDialogOpen(false);
  }

  function openEdit(access: PlatformAccess) {
    setEditingId(access.id);
    setFormName(access.platform_name);
    setFormUsername(access.username_email);
    setFormPassword('');
    setFormType(access.platform_type);
    setFormLink(access.direct_link || '');
    setFormNotes(access.notes || '');
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!formName.trim() || !formUsername.trim()) {
      toast.error('Nome e username são obrigatórios');
      return;
    }
    if (!editingId && !formPassword.trim()) {
      toast.error('Password é obrigatória');
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        platform_name: formName,
        username_email: formUsername,
        password: formPassword || undefined,
        platform_type: formType,
        direct_link: formLink || undefined,
        notes: formNotes || undefined,
      });
    } else {
      createMutation.mutate({
        platform_name: formName,
        username_email: formUsername,
        password: formPassword,
        platform_type: formType,
        direct_link: formLink || undefined,
        notes: formNotes || undefined,
      });
    }
  }

  async function toggleReveal(id: string) {
    if (revealedPasswords[id]) {
      setRevealedPasswords(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }
    setRevealingId(id);
    try {
      const { password } = await invokeAccessFn('decrypt', { id });
      setRevealedPasswords(prev => ({ ...prev, [id]: password }));
      // Auto-hide after 10 seconds
      setTimeout(() => {
        setRevealedPasswords(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }, 10000);
    } catch (e: any) {
      toast.error('Não foi possível revelar a password');
    } finally {
      setRevealingId(null);
    }
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <BackNavigation />
        <PageHeader title="Acessos" />
        <div className="flex items-center justify-between">
          <div />
          <Button onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Acesso
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : accesses.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
            <p className="text-muted-foreground">Nenhum acesso registado</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4" /> Adicionar primeiro acesso
            </Button>
          </div>
        ) : (
          <div className="rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plataforma</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Username / Email</TableHead>
                  <TableHead>Password</TableHead>
                  <TableHead>Link</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accesses.map(a => {
                  const typeInfo = getTypeInfo(a.platform_type);
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.platform_name}</TableCell>
                      <TableCell>
                        <Badge className={`${typeInfo.color} border-0`}>{typeInfo.label}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{a.username_email}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {revealedPasswords[a.id] || '••••••••'}
                          </span>
                          <Button
                            variant="ghost"
                            aria-label="Esconder" size="icon"
                            className="h-7 w-7"
                            disabled={revealingId === a.id}
                            onClick={() => toggleReveal(a.id)}
                          >
                            {revealedPasswords[a.id] ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        {a.direct_link ? (
                          <a href={a.direct_link} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" aria-label="Editar" size="icon" className="h-7 w-7" onClick={() => openEdit(a)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive"
                            aria-label="Eliminar acesso"
                            onClick={async () => {
                              const ok = await confirm({
                                title: 'Eliminar acesso?',
                                description: 'Esta ação é permanente e não pode ser revertida.',
                                confirmText: 'Eliminar',
                                variant: 'destructive',
                              });
                              if (ok) deleteMutation.mutate(a.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Dialog for create/edit */}
        <Dialog open={dialogOpen} onOpenChange={v => { if (!v) resetForm(); }}>
          <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingId ? 'Editar Acesso' : 'Novo Acesso'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="space-y-1.5">
                <Label>Nome da plataforma *</Label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="Ex: Google Workspace" />
              </div>
              <div className="space-y-1.5">
                <Label>Username / Email *</Label>
                <Input value={formUsername} onChange={e => setFormUsername(e.target.value)} placeholder="user@email.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Password {editingId ? '(deixar vazio para manter)' : '*'}</Label>
                <Input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de plataforma</Label>
                <Select value={formType} onValueChange={setFormType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORM_TYPES.map(t => (
                      <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Link direto</Label>
                <Input value={formLink} onChange={e => setFormLink(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1.5">
                <Label>Notas / Observações</Label>
                <MentionTextarea value={formNotes} onChange={setFormNotes} rows={3} placeholder="Notas... usa @ para mencionar" />
              </div>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) ? 'A guardar...' : editingId ? 'Guardar Alterações' : 'Criar Acesso'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
