import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List } from 'lucide-react';
import { useCrmData } from '@/hooks/useCrmData';
import { useCommercialData } from '@/hooks/useCommercialData';
import { CrmSummary } from './crm/CrmSummary';
import { CrmPipeline } from './crm/CrmPipeline';
import { CrmListView } from './crm/CrmListView';
import { LeadDetailSheet } from './crm/LeadDetailSheet';
import { toast } from 'sonner';

export function CommercialCRM() {
  const [view, setView] = useState<'pipeline' | 'list'>('pipeline');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  const { allLeads, activeLeads, leadsToContact, pipelineValue, winsThisMonth, upsertLead, deleteLead } = useCrmData();
  const { productGoals } = useCommercialData();
  const products = (productGoals.data || []).map(p => p.product_name);

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
      {/* Top controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-1 rounded-lg border p-1">
          <Button
            variant={view === 'pipeline' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setView('pipeline')}
          >
            <LayoutGrid className="h-4 w-4 mr-1" /> Pipeline
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

      {/* Summary + Alerts */}
      <CrmSummary
        activeCount={activeLeads.length}
        toContactToday={leadsToContact}
        pipelineValue={pipelineValue}
        winsThisMonth={winsThisMonth}
        onOpenLead={openLead}
      />

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
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
