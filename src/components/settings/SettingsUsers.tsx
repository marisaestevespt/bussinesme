import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useTeamPhotos } from '@/hooks/useTeamPhotos';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Users, ShieldOff, Mail } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from '@/components/ui/dialog';

export function SettingsUsers() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [emailDialog, setEmailDialog] = useState<{ open: boolean; profile: any | null }>({ open: false, profile: null });
  const [newEmail, setNewEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const { getPhotoUrl } = useTeamPhotos();

  const { data: profiles = [], isLoading } = useQuery({
    queryKey: ['settings-profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: roles = [] } = useQuery({
    queryKey: ['settings-user-roles'],
    queryFn: async () => {
      const { data } = await supabase.from('user_roles').select('user_id, role');
      return data || [];
    },
  });

  const isOwnerUser = (userId: string) => roles.some(r => r.user_id === userId && r.role === 'owner');

  const handleRevokeAccess = async (profile: any) => {
    try {
      await supabase.from('members').delete().eq('user_id', profile.user_id);
      await supabase.from('user_roles').delete().eq('user_id', profile.user_id).neq('role', 'owner');
      qc.invalidateQueries({ queryKey: ['settings-profiles'] });
      qc.invalidateQueries({ queryKey: ['settings-user-roles'] });
      toast.success(`Acesso removido para ${profile.full_name || 'utilizador'}`);
    } catch (err: any) {
      toast.error('Erro ao remover acesso: ' + (err.message || err));
    }
  };

  const handleChangeEmail = async () => {
    if (!emailDialog.profile || !newEmail.trim()) return;
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('update-user-email', {
        body: { target_user_id: emailDialog.profile.user_id, new_email: newEmail.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Email atualizado para ${newEmail.trim()}`);
      setEmailDialog({ open: false, profile: null });
      setNewEmail('');
    } catch (err: any) {
      toast.error('Erro ao alterar email: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-foreground">
        <Users className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold tracking-tight uppercase">Utilizadores registados</h2>
      </div>
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-8">A carregar...</p>
          ) : profiles.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem utilizadores registados</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilizador</TableHead>
                    <TableHead>Cargo</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>Registo</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => {
                    const owner = isOwnerUser(p.user_id);
                    const isSelf = p.user_id === user?.id;
                    return (
                      <TableRow key={p.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={getPhotoUrl(p)} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {(p.full_name || '?').slice(0, 2).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{p.full_name || 'Sem nome'}</p>
                              {owner && <Badge variant="default" className="text-[10px]">Owner</Badge>}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {p.role_title ? (
                            <Badge variant="secondary" className="text-[10px]">{p.role_title}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {p.phone || '—'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {format(parseISO(p.created_at), 'dd/MM/yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {!isSelf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                                onClick={() => {
                                  setEmailDialog({ open: true, profile: p });
                                  setNewEmail('');
                                }}
                              >
                                <Mail className="h-3.5 w-3.5 mr-1" />
                                <span className="text-xs">Alterar email</span>
                              </Button>
                            )}
                            {!owner && !isSelf && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 px-2">
                                    <ShieldOff className="h-3.5 w-3.5 mr-1" />
                                    <span className="text-xs">Remover acesso</span>
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Remover acesso</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Tens a certeza que queres remover o acesso de <strong>{p.full_name}</strong>? Esta pessoa perderá todas as permissões de módulos.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleRevokeAccess(p)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Remover
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="text-[11px] text-muted-foreground">
        Total: {profiles.length} utilizador{profiles.length !== 1 ? 'es' : ''}
      </p>

      {/* Change email dialog */}
      <Dialog open={emailDialog.open} onOpenChange={(o) => { if (!o) setEmailDialog({ open: false, profile: null }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Alterar email de acesso</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Alterar o email de login de <strong>{emailDialog.profile?.full_name}</strong>.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="new-email" className="text-xs">Novo email</Label>
              <Input
                id="new-email"
                type="email"
                placeholder="novo@email.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">Cancelar</Button>
            </DialogClose>
            <Button size="sm" disabled={!newEmail.trim() || saving} onClick={handleChangeEmail}>
              {saving ? 'A guardar...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}