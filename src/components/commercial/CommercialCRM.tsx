import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List, SlidersHorizontal } from 'lucide-react';
import { useCrmData } from '@/hooks/useCrmData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { CrmSummary } from './crm/CrmSummary';
import { CrmPipeline } from './crm/CrmPipeline';
import { CrmListView } from './crm/CrmListView';
import { CrmCustomView } from './crm/CrmCustomView';
import { LeadDetailSheet } from './crm/LeadDetailSheet';
import { toast } from 'sonner';

export function CommercialCRM() {
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  const { allLeads, activeLeads, leadsToContact, pipelineValue, winsThisMonth, upsertLead, deleteLead } = useCrmData();
  const { productGoals } = useCommercialData();
  const products = (productGoals.data || []).map(p => p.product_name);

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-commercial-team'],
    queryFn: async () => {
      // Get owners
      const { data: ownerRoles } = await supabase.from('user_roles').select('user_id').eq('role', 'owner');
      const ownerIds = (ownerRoles || []).map(r => r.user_id);

      // Get members with comercial module permission
      const { data: commercialPerms } = await supabase
        .from('role_permissions')
        .select('custom_role_id')
        .eq('module_key', 'comercial')
        .eq('can_view', true);
      const commercialRoleIds = (commercialPerms || []).map(p => p.custom_role_id);

      let commercialUserIds: string[] = [];
      if (commercialRoleIds.length > 0) {
        const { data: members } = await supabase
          .from('members')
          .select('user_id')
          .in('custom_role_id', commercialRoleIds);
        commercialUserIds = (members || []).map(m => m.user_id);
      }

      const allUserIds = [...new Set([...ownerIds, ...commercialUserIds])];
      if (allUserIds.length === 0) return [];

      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, user_id')
        .in('user_id', allUserIds)
        .order('full_name');
      return (data || []).map(p => ({ id: p.id, full_name: p.full_name }));
    },
  });

  const openLead = useCallback((lead: any) => {
    setSelectedLead(lead);
    setSheetOpen(true);
  }, []);

  const openNew = () => {
    setSelectedLead(null);
    setSheetOpen(true);
  };

  const handleSave = (lead: any) => {
    upsertLead.mutate(lead, {
      onSuccess: () => {
        setSheetOpen(false);
        setSelectedLead(null);
        if (lead.status === 'ganho' && !lead.id) {
          toast.info('Lead marcada como Ganha! Pode converter em cliente no módulo de Clientes.');
        }
      },
    });
  };

  const handleUpdateStatus = useCallback((leadId: string, newStatus: string) => {
    const lead = allLeads.find(l => l.id === leadId);
    if (!lead) return;
    if (newStatus === 'perdido') {
      setSelectedLead({ ...lead, status: newStatus });
      setSheetOpen(true);
      return;
    }
    upsertLead.mutate({ id: leadId, status: newStatus }, {
      onSuccess: () => {
        if (newStatus === 'ganho') {
          toast.info('Lead marcada como Ganha! Pode converter em cliente no módulo de Clientes.');
        }
      },
    });
  }, [allLeads, upsertLead]);

  const handleDelete = (id: string) => {
    deleteLead.mutate(id);
  };

  return (
    <div className="space-y-6">

      {/* Summary + Alerts */}
      <CrmSummary
        activeCount={activeLeads.length}
        toContactToday={leadsToContact}
        pipelineValue={pipelineValue}
        winsThisMonth={winsThisMonth}
        allLeads={allLeads}
        onOpenLead={openLead}
      />

      {/* View tabs + Nova Lead */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 rounded-lg border p-1">
        <Button
          variant={view === 'pipeline' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setView('pipeline')}
        >
          <LayoutGrid className="h-4 w-4 mr-1" /> CRM
        </Button>
        <Button
          variant={view === 'list' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setView('list')}
        >
          <List className="h-4 w-4 mr-1" /> Lista
        </Button>
        </div>
        <Button size="sm" onClick={openNew}><Plus className="h-4 w-4 mr-1" /> Nova Lead</Button>
      </div>

      {/* Views */}
      {view === 'pipeline' ? (
        <CrmPipeline leads={allLeads} onOpenLead={openLead} onUpdateStatus={handleUpdateStatus} />
      ) : (
        <CrmListView leads={allLeads} onOpenLead={openLead} />
      )}

      {/* Lead Detail Sheet */}
      <LeadDetailSheet
        open={sheetOpen}
        onOpenChange={v => { setSheetOpen(v); if (!v) setSelectedLead(null); }}
        lead={selectedLead}
        products={products}
        profiles={profiles}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
