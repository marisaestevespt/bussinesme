import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';

export function SettingsUsers() {
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={p.avatar_url || undefined} />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                              {(p.full_name || '?').slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{p.full_name || 'Sem nome'}</p>
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
                    </TableRow>
                  ))}
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
