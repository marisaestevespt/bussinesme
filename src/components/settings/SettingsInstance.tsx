import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Globe, Type, LayoutGrid, Save, Lock } from 'lucide-react';
import { SECTOR_OPTIONS, buildSectorConfig, type BusinessSector } from '@/lib/sector-config';
import { MODULES, MODULE_KEYS } from '@/lib/modules';
import { SectorTemplateApplier } from '@/components/settings/SectorTemplateApplier';

/* ── section wrapper ── */

function Section({ icon: Icon, title, description, children }: {
  icon: React.ElementType;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <h2 className="text-sm font-semibold tracking-tight uppercase">{title}</h2>
      </div>
      {description && <p className="text-sm text-muted-foreground -mt-2">{description}</p>}
      <div className="rounded-lg border bg-card p-5 space-y-4">
        {children}
      </div>
    </div>
  );
}

/* ── terminology row ── */

const BASE_LABELS: Record<string, string> = {
  cliente: 'Cliente',
  clientes: 'Clientes',
  projeto: 'Projeto',
  projetos: 'Projetos',
  reuniao: 'Reunião',
  reunioes: 'Reuniões',
  venda: 'Venda',
  vendas: 'Vendas',
  lead: 'Lead',
  leads: 'Leads',
  contrato: 'Contrato',
  entregavel: 'Entregável',
};

const TERM_ROWS = Object.keys(BASE_LABELS) as (keyof typeof BASE_LABELS)[];

/* ── non-toggleable modules (core navigation, always visible) ── */
const LOCKED_MODULES = new Set(['comeca-aqui', 'acessos']);

/* ── section labels ── */
const SECTION_LABELS: Record<string, string> = {
  transversais: 'Transversais',
  departamentos: 'Departamentos',
  executive: 'Executive Room',
};

/* ── main component ── */

export function SettingsInstance() {
  const { settings, refetch } = useBusinessSettings();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [sector, setSector] = useState<BusinessSector>('servicos_digitais');
  const [disabledModules, setDisabledModules] = useState<string[]>([]);

  useEffect(() => {
    if (!settings) return;
    setSector((settings.business_sector as BusinessSector) || 'servicos_digitais');
    setDisabledModules(settings.disabled_modules || []);
  }, [settings]);

  const sectorConfig = buildSectorConfig(sector);
  const currentSectorOption = SECTOR_OPTIONS.find(s => s.value === sector);

  const toggleModule = (key: string) => {
    if (LOCKED_MODULES.has(key)) return;
    setDisabledModules(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    );
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('business_settings')
        .update({ business_sector: sector, disabled_modules: disabledModules } as any)
        .eq('id', settings.id);
      if (error) throw error;
      toast.success('Configuração da instância guardada!');
      await refetch();
      qc.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao guardar.');
    } finally {
      setSaving(false);
    }
  };

  // Group modules by section (exclude 'comeca-aqui' section from toggles)
  const toggleableSections = ['transversais', 'departamentos', 'executive'] as const;
  const modulesBySection = toggleableSections.map(section => ({
    section,
    label: SECTION_LABELS[section],
    modules: MODULE_KEYS.filter(k => MODULES[k].section === section),
  }));

  const activeCount = MODULE_KEYS.filter(k => !disabledModules.includes(k)).length;

  if (!settings) return null;

  return (
    <div className="space-y-6">

      {/* ── Setor do Negócio ── */}
      <Section
        icon={Globe}
        title="Setor do Negócio"
        description="Define o setor adapta automaticamente a terminologia e os templates sugeridos para o teu tipo de negócio."
      >
        <div className="space-y-3">
          <Select value={sector} onValueChange={v => setSector(v as BusinessSector)}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SECTOR_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  <div>
                    <span className="font-medium">{opt.label}</span>
                    <span className="text-xs text-muted-foreground ml-2">{opt.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {currentSectorOption && (
            <p className="text-xs text-muted-foreground border-l-2 border-primary/30 pl-3">
              {currentSectorOption.description}
            </p>
          )}
        </div>

        {/* Templates do setor */}
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-2">
            Aplica automaticamente SOPs, categorias financeiras e rotinas típicas do setor selecionado.
          </p>
          <SectorTemplateApplier sector={sector} />
        </div>
      </Section>

      {/* ── Terminologia ── */}
      <Section
        icon={Type}
        title="Terminologia"
        description="Com base no setor selecionado, estes são os termos que serão usados em todo o sistema."
      >
        <div className="overflow-hidden rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-1/2">
                  Termo padrão
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide w-1/2">
                  Neste sistema
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {TERM_ROWS.map(key => {
                const base = BASE_LABELS[key];
                const custom = sectorConfig.t(key as any);
                const changed = custom !== base;
                return (
                  <tr key={key} className={changed ? 'bg-primary/5' : ''}>
                    <td className="px-4 py-2.5 text-muted-foreground">{base}</td>
                    <td className="px-4 py-2.5 font-medium flex items-center gap-2">
                      {custom}
                      {changed && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">
                          adaptado
                        </Badge>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {sector === 'servicos_digitais' && (
          <p className="text-xs text-muted-foreground">
            O setor "Serviços Digitais" usa a terminologia padrão do sistema — nenhum termo é alterado.
          </p>
        )}
      </Section>

      {/* ── Módulos Ativos ── */}
      <Section
        icon={LayoutGrid}
        title="Módulos Ativos"
        description={`Escolhe quais módulos estão visíveis nesta instância. ${activeCount} módulos ativos.`}
      >
        <div className="space-y-6">
          {modulesBySection.map(({ section, label, modules }) => (
            <div key={section} className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {label}
              </p>
              <div className="space-y-1">
                {modules.map(key => {
                  const mod = MODULES[key];
                  const isDisabled = disabledModules.includes(key);
                  const isLocked = LOCKED_MODULES.has(key);
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">{mod.label}</span>
                        {isLocked && (
                          <Lock className="h-3 w-3 text-muted-foreground/50" />
                        )}
                      </div>
                      <Switch
                        checked={!isDisabled}
                        onCheckedChange={() => toggleModule(key)}
                        disabled={isLocked}
                        aria-label={`${isDisabled ? 'Ativar' : 'Desativar'} ${mod.label}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-muted-foreground border-l-2 border-amber-400/50 pl-3">
          Desativar um módulo esconde-o do menu lateral para todos os membros. Os dados existentes não são apagados.
        </p>
      </Section>

      <Button onClick={handleSave} className="h-11 gap-2" disabled={saving}>
        <Save className="h-4 w-4" />
        {saving ? 'A guardar...' : 'Guardar configuração'}
      </Button>
    </div>
  );
}
