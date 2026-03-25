import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { MODULES, type ModuleKey } from '@/lib/modules';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';

const DEPT_MODULE_MAP: Record<string, string[]> = {
  admin: ['marketing', 'comercial', 'clientes', 'financeiro', 'operacao', 'produtos', 'recursos-humanos', 'equipa', 'planeamento', 'weekly-align', 'gestao-equipa-ceo'],
  marketing: ['marketing'],
  comercial: ['comercial'],
  clientes: ['clientes'],
  financeiro: ['financeiro'],
  operacao: ['operacao'],
  produtos: ['produtos'],
  'recursos-humanos': ['recursos-humanos'],
};

const HALL_MODULES = ['comeca-aqui', 'mural', 'hub-equipa'];
const TRANSVERSAL_MODULES = ['agenda', 'reunioes', 'acessos', 'projetos', 'processos', 'tarefas', 'biblioteca'];
const SECRETARIA_MODULES = ['secretaria'];

interface Props {
  department: string;
  departmentLabel: string;
  selectedExtras: string[];
  onExtrasChange: (extras: string[]) => void;
}

export function InlineDeptPagePicker({ department, departmentLabel, selectedExtras, onExtrasChange }: Props) {
  const [expanded, setExpanded] = useState(true);

  const autoModules = new Set([
    ...HALL_MODULES,
    ...TRANSVERSAL_MODULES,
    ...SECRETARIA_MODULES,
    ...(DEPT_MODULE_MAP[department] || []),
  ]);

  const autoList = [...autoModules]
    .map(key => MODULES[key as ModuleKey])
    .filter(Boolean)
    .map(m => m.label);

  const extraOptions = Object.entries(MODULES)
    .filter(([key]) => !autoModules.has(key))
    .map(([key, val]) => ({ key, label: val.label, section: val.section }));

  const toggle = (key: string) => {
    const next = selectedExtras.includes(key)
      ? selectedExtras.filter(k => k !== key)
      : [...selectedExtras, key];
    onExtrasChange(next);
  };

  return (
    <div className="ml-2 border-l-2 border-primary/20 pl-3 space-y-2 mt-1.5">
      <button
        type="button"
        className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        Páginas de {departmentLabel}
        {selectedExtras.length > 0 && (
          <Badge variant="default" className="text-[9px] h-4 px-1.5 ml-1">+{selectedExtras.length}</Badge>
        )}
      </button>

      {expanded && (
        <div className="space-y-2">

          {extraOptions.length > 0 && (
            <div>
              <p className="text-[10px] text-muted-foreground mb-1">Páginas extra (opcional):</p>
              <div className="grid grid-cols-1 gap-0.5">
                {extraOptions.map(opt => (
                  <label
                    key={opt.key}
                    className={cn(
                      'flex items-center gap-2 rounded px-2 py-1 cursor-pointer transition-colors text-[11px]',
                      selectedExtras.includes(opt.key) ? 'bg-primary/5 text-foreground' : 'hover:bg-muted/50 text-muted-foreground'
                    )}
                  >
                    <Checkbox
                      checked={selectedExtras.includes(opt.key)}
                      onCheckedChange={() => toggle(opt.key)}
                      className="h-3.5 w-3.5"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
