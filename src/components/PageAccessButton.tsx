import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { UserPlus, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface PageAccessButtonProps {
  pagePath: string;
  pageTitle: string;
}

export function PageAccessButton({ pagePath, pageTitle }: PageAccessButtonProps) {
  const { isOwner, user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState('');

  const { data: grants = [] } = useQuery({
    queryKey: ['page-access-grants', pagePath],
    queryFn: async () => {
      const { data } = await supabase
        .from('page_access_grants')
        .select('*, profiles:user_id(full_name, avatar_url)')
        .eq('page_path', pagePath);
      return (data || []) as any[];
    },
    enabled: open && isOwner,
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['all-profiles-for-access'],
    queryFn: async () => {
      const { data } = await supabase.from('profiles').select('user_id, full_name').order('full_name');
      return data || [];
    },
    enabled: open && isOwner,
  });

  // Only owners/admins can grant access
  if (!isOwner) return null;

  const grantAccess = async () => {
    if (!selectedUser) return;
    const { error } = await supabase.from('page_access_grants').insert({
      user_id: selectedUser,
      page_path: pagePath,
      page_title: pageTitle,
      granted_by: user?.id,
    });
    if (error) {
      if (error.code === '23505') toast.info('Esta pessoa já tem acesso a esta página.');
      else toast.error('Erro ao dar acesso');
    } else {
      toast.success('Acesso concedido!');
      qc.invalidateQueries({ queryKey: ['page-access-grants', pagePath] });
    }
    setSelectedUser('');
  };

  const revokeAccess = async (id: string) => {
    await supabase.from('page_access_grants').delete().eq('id', id);
    toast.success('Acesso removido');
    qc.invalidateQueries({ queryKey: ['page-access-grants', pagePath] });
  };

  // Filter out users who already have access
  const grantedUserIds = new Set(grants.map((g: any) => g.user_id));
  const availableProfiles = profiles.filter(p => !grantedUserIds.has(p.user_id));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-foreground/5">
              <UserPlus className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Dar acesso a esta página</TooltipContent>
      </Tooltip>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-medium">Acesso a esta página</h4>
            <p className="text-[11px] text-muted-foreground">Dar acesso excecional a alguém.</p>
          </div>

          <div className="flex gap-2">
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="flex-1 h-8 text-xs">
                <SelectValue placeholder="Selecionar pessoa" />
              </SelectTrigger>
              <SelectContent>
                {availableProfiles.map(p => (
                  <SelectItem key={p.user_id} value={p.user_id}>{p.full_name || 'Sem nome'}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" onClick={grantAccess} disabled={!selectedUser}>
              Dar acesso
            </Button>
          </div>

          {grants.length > 0 && (
            <div className="space-y-2 pt-1 border-t">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide">Com acesso</span>
              {grants.map((g: any) => (
                <div key={g.id} className="flex items-center justify-between">
                  <Badge variant="secondary" className="text-[10px]">
                    {g.profiles?.full_name || 'Sem nome'}
                  </Badge>
                  <button onClick={() => revokeAccess(g.id)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
