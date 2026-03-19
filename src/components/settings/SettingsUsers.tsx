import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, ShieldOff } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export function SettingsUsers() {
  const { user } = useAuth();
  const qc = useQueryClient();

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
      // Remove from members table (revokes module permissions)
      await supabase.from('members').delete().eq('user_id', profile.user_id);
      // Remove non-owner roles from user_roles
      await supabase.from('user_roles').delete().eq('user_id', profile.user_id).neq('role', 'owner');
      qc.invalidateQueries({ queryKey: ['settings-profiles'] });
      qc.invalidateQueries({ queryKey: ['settings-user-roles'] });
      toast.success(`Acesso removido para ${profile.full_name || 'utilizador'}`);
    } catch (err: any) {
      toast.error('Erro ao remover acesso: ' + (err.message || err));
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
                              <AvatarImage src={p.avatar_url || undefined} />
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
    </div>
  );
}