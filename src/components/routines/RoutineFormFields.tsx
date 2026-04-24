import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

/**
 * Shared form fields for "Nova Rotina" dialog.
 * Used by DepartmentProcessos (single-dept) and Processos page (multi-dept).
 * The "Departamento" select is rendered by the parent via `extraTopField`
 * because each context selects from a different list.
 */
export interface RoutineFormFieldsProps {
  // Title
  title: string;
  onTitleChange: (v: string) => void;

  // Role function (autocomplete + custom)
  roleFunction: string;
  onRoleFunctionChange: (v: string) => void;
  roleCustom: string;
  onRoleCustomChange: (v: string) => void;
  roleOpen: boolean;
  onRoleOpenChange: (v: boolean) => void;
  existingRoles: string[];

  // Recurrence
  recurrence: 'semanal' | 'mensal';
  onRecurrenceChange: (v: 'semanal' | 'mensal') => void;
  weekday: string;
  onWeekdayChange: (v: string) => void;
  monthDay: string;
  onMonthDayChange: (v: string) => void;
  hour: string;
  onHourChange: (v: string) => void;
  adjustBiz: boolean;
  onAdjustBizChange: (v: boolean) => void;

  /** Optional content rendered next to the title (e.g. department picker) */
  extraTopField?: React.ReactNode;
  /** Layout: 'single' (mobile-style, sm:max-w-md) or 'wide' (2-col grid). */
  layout?: 'single' | 'wide';
  hourInputClassName?: string;
}

export function RoutineFormFields({
  title, onTitleChange,
  roleFunction, onRoleFunctionChange,
  roleCustom, onRoleCustomChange,
  roleOpen, onRoleOpenChange,
  existingRoles,
  recurrence, onRecurrenceChange,
  weekday, onWeekdayChange,
  monthDay, onMonthDayChange,
  hour, onHourChange,
  adjustBiz, onAdjustBizChange,
  extraTopField,
  layout = 'single',
  hourInputClassName,
}: RoutineFormFieldsProps) {
  const wide = layout === 'wide';
  return (
    <>
      <div className={wide ? 'grid grid-cols-2 gap-3' : ''}>
        <div>
          <Label>Título *</Label>
          <Input
            value={title}
            onChange={e => onTitleChange(e.target.value)}
            placeholder="Ex: Revisão semanal de KPIs"
          />
        </div>
        {extraTopField}
      </div>

      <div className={wide ? 'grid grid-cols-2 gap-3' : ''}>
        <div>
          <Label>Função responsável</Label>
          <Popover open={roleOpen} onOpenChange={onRoleOpenChange}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full justify-start font-normal">
                {roleFunction || <span className="text-muted-foreground">Selecionar ou criar...</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-0" align="start">
              <Command>
                <CommandInput
                  placeholder="Pesquisar ou criar função..."
                  value={roleCustom}
                  onValueChange={onRoleCustomChange}
                />
                <CommandList>
                  <CommandEmpty>
                    {roleCustom.trim() && (
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent rounded"
                        onClick={() => { onRoleFunctionChange(roleCustom.trim()); onRoleOpenChange(false); }}
                      >
                        Criar "<strong>{roleCustom.trim()}</strong>"
                      </button>
                    )}
                  </CommandEmpty>
                  <CommandGroup>
                    {existingRoles.map(role => (
                      <CommandItem
                        key={role}
                        value={role}
                        onSelect={() => { onRoleFunctionChange(role); onRoleCustomChange(''); onRoleOpenChange(false); }}
                      >
                        {role}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div>
          <Label>Tipo de recorrência</Label>
          <Select value={recurrence} onValueChange={v => onRecurrenceChange(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="semanal">Semanal</SelectItem>
              <SelectItem value="mensal">Mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {recurrence === 'semanal' && (
          <div>
            <Label>Dia da semana</Label>
            <Select value={weekday} onValueChange={onWeekdayChange}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="1">Segunda-feira</SelectItem>
                <SelectItem value="2">Terça-feira</SelectItem>
                <SelectItem value="3">Quarta-feira</SelectItem>
                <SelectItem value="4">Quinta-feira</SelectItem>
                <SelectItem value="5">Sexta-feira</SelectItem>
                <SelectItem value="6">Sábado</SelectItem>
                <SelectItem value="7">Domingo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}
        {recurrence === 'mensal' && (
          <div>
            <Label>Dia do mês</Label>
            <Input type="number" min={1} max={31} value={monthDay} onChange={e => onMonthDayChange(e.target.value)} />
          </div>
        )}
        <div>
          <Label>Hora</Label>
          <Input
            type="time"
            value={hour}
            onChange={e => onHourChange(e.target.value)}
            className={hourInputClassName}
          />
        </div>
      </div>

      {recurrence === 'mensal' && (
        <div className="flex items-center gap-2">
          <Switch checked={adjustBiz} onCheckedChange={onAdjustBizChange} />
          <Label className="text-sm">Ajustar para dia útil anterior (se cair em fim de semana)</Label>
        </div>
      )}
    </>
  );
}