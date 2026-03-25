import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

/** Subpages available inside each department */
const DEPT_SUBPAGES: Record<string, { key: string; label: string }[]> = {
  marketing: [
    { key: 'mkt-dashboard', label: 'Dashboard' },
    { key: 'mkt-gestao-marca', label: 'Gestão de Marca' },
    { key: 'mkt-estrategia', label: 'Estratégia' },
    { key: 'mkt-conteudos', label: 'Conteúdos & Canais' },
    { key: 'mkt-processos', label: 'Processos' },
    { key: 'mkt-recursos', label: 'Recursos' },
    { key: 'mkt-automacoes', label: 'Automações' },
    { key: 'mkt-funis', label: 'Funis' },
    { key: 'mkt-trafego', label: 'Tráfego Pago' },
    { key: 'mkt-analise', label: 'Análise' },
  ],
  comercial: [
    { key: 'com-dashboard', label: 'Dashboard' },
    { key: 'com-metas', label: 'Metas Comerciais' },
    { key: 'com-vendas', label: 'Vendas' },
    { key: 'com-acoes', label: 'Ações de Vendas' },
    { key: 'com-crm', label: 'CRM' },
    { key: 'com-estrategia', label: 'Estratégia' },
    { key: 'com-biblioteca', label: 'Biblioteca' },
    { key: 'com-processos', label: 'Processos' },
    { key: 'com-analise', label: 'Análise Comercial' },
  ],
  clientes: [
    { key: 'cli-dashboard', label: 'Dashboard' },
    { key: 'cli-analise', label: 'Análise' },
    { key: 'cli-portais', label: 'Portais' },
    { key: 'cli-feedback', label: 'Feedback' },
  ],
  financeiro: [
    { key: 'fin-dashboard', label: 'Dashboard' },
    { key: 'fin-mensal', label: 'Mensal' },
    { key: 'fin-trimestral', label: 'Trimestral' },
    { key: 'fin-iva', label: 'IVA' },
    { key: 'fin-ss', label: 'Segurança Social' },
    { key: 'fin-documentos', label: 'Documentos' },
    { key: 'fin-entradas', label: 'Entradas' },
    { key: 'fin-saidas', label: 'Saídas' },
    { key: 'fin-ordenados', label: 'Ordenados' },
    { key: 'fin-previsibilidade', label: 'Previsibilidade' },
    { key: 'fin-setup', label: 'Setup Financeiro' },
  ],
  operacao: [
    { key: 'ops-dashboard', label: 'Dashboard' },
  ],
  produtos: [
    { key: 'prod-dashboard', label: 'Dashboard' },
  ],
  'recursos-humanos': [
    { key: 'rh-dashboard', label: 'Dashboard' },
    { key: 'rh-equipa', label: 'Equipa' },
    { key: 'rh-escala', label: 'Escala' },
    { key: 'rh-performance', label: 'Performance' },
    { key: 'rh-feedback', label: 'Feedback' },
    { key: 'rh-contratos', label: 'Contratos' },
  ],
};

interface Props {
  department: string;
  departmentLabel: string;
  selectedExtras: string[];
  onExtrasChange: (extras: string[]) => void;
}

export function InlineDeptPagePicker({ department, departmentLabel, selectedExtras, onExtrasChange }: Props) {
  const [expanded, setExpanded] = useState(true);

  const subpages = DEPT_SUBPAGES[department] || [];

  const toggle = (key: string) => {
    const next = selectedExtras.includes(key)
      ? selectedExtras.filter(k => k !== key)
      : [...selectedExtras, key];
    onExtrasChange(next);
  };

  if (subpages.length === 0) return null;

  return (
    <div className="ml-2 border-l-2 border-primary/20 pl-3 space-y-2 mt-1.5">
      <button
        type="button"
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Subpáginas de {departmentLabel}
        {selectedExtras.length > 0 && (
          <Badge variant="default" className="text-[9px] h-4 px-1.5 ml-1">+{selectedExtras.length}</Badge>
        )}
      </button>

      {expanded && (
        <div className="grid grid-cols-1 gap-0.5">
          {subpages.map(sp => (
            <label
              key={sp.key}
              className={cn(
                'flex items-center gap-2 rounded px-2 py-1 cursor-pointer transition-colors text-[11px]',
                selectedExtras.includes(sp.key) ? 'bg-primary/5 text-foreground' : 'hover:bg-muted/50 text-muted-foreground'
              )}
            >
              <Checkbox
                checked={selectedExtras.includes(sp.key)}
                onCheckedChange={() => toggle(sp.key)}
                className="h-3.5 w-3.5"
              />
              <span>{sp.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
