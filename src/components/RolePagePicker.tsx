import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MODULES, type ModuleKey } from '@/lib/modules';

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

interface RolePagePickerProps {
  open: boolean;
  onClose: () => void;
  memberName: string;
  department: string;
  onConfirm: (extraModules: string[]) => void;
}

export function RolePagePicker({ open, onClose, memberName, department, onConfirm }: RolePagePickerProps) {
  // Calculate auto-included modules
  const autoModules = new Set([
    ...HALL_MODULES,
    ...TRANSVERSAL_MODULES,
    ...SECRETARIA_MODULES,
    ...(DEPT_MODULE_MAP[department] || []),
  ]);

  // All possible modules that are NOT already included
  const extraOptions = Object.entries(MODULES)
    .filter(([key]) => !autoModules.has(key))
    .map(([key, val]) => ({ key, label: val.label, section: val.section }));

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const autoList = [...autoModules]
    .map(key => MODULES[key as ModuleKey])
    .filter(Boolean)
    .map(m => m.label);

  const handleConfirm = () => {
    onConfirm(Array.from(selected));
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Acessos de {memberName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Com base no departamento selecionado, <strong>{memberName}</strong> terá acesso automático a:
            </p>
            <div className="flex flex-wrap gap-1 mt-2">
              {autoList.map(label => (
                <Badge key={label} variant="secondary" className="text-[10px]">{label}</Badge>
              ))}
            </div>
          </div>

          {extraOptions.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Queres dar acesso a mais alguma página?</p>
              <div className="grid grid-cols-1 gap-1">
                {extraOptions.map(opt => (
                  <label
                    key={opt.key}
                    className={cn(
                      'flex items-center gap-2.5 rounded-md border px-3 py-2 cursor-pointer transition-colors text-xs',
                      selected.has(opt.key) ? 'border-primary bg-primary/5' : 'border-border hover:border-muted-foreground/30'
                    )}
                  >
                    <Checkbox
                      checked={selected.has(opt.key)}
                      onCheckedChange={() => toggle(opt.key)}
                    />
                    <span>{opt.label}</span>
                    <Badge variant="outline" className="text-[9px] ml-auto">{opt.section}</Badge>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => { onConfirm([]); onClose(); }}>
            Não, está bom assim
          </Button>
          <Button onClick={handleConfirm} disabled={selected.size === 0}>
            Confirmar {selected.size > 0 ? `(+${selected.size})` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
