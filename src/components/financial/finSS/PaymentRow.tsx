import { useState } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Save } from 'lucide-react';
import { formatEuro } from '@/lib/formatting';
import { SS_MONTHS } from './types';

interface PaymentRowProps {
  month: number;
  predicted: number;
  paid: number;
  isPaid: boolean;
  onSave: (month: number, value: number) => Promise<void>;
  onToggle: (month: number) => Promise<void>;
  extraCells?: React.ReactNode;
}

export function PaymentRow({ month, predicted, paid, isPaid, onSave, onToggle, extraCells }: PaymentRowProps) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);

  const handleSave = async () => {
    const val = parseFloat(value) || predicted;
    if (val <= 0) return;
    setSaving(true);
    await onSave(month, val);
    setValue('');
    setSaving(false);
  };

  const handleToggle = async () => {
    setToggling(true);
    if (!isPaid) {
      const val = parseFloat(value) || predicted;
      if (val > 0) {
        await onSave(month, val);
        setValue('');
      }
    } else {
      await onToggle(month);
    }
    setToggling(false);
  };

  return (
    <TableRow>
      <TableCell className="font-medium">{String(month).padStart(2, '0')} {SS_MONTHS[month - 1]}</TableCell>
      {extraCells}
      <TableCell className="text-right">{predicted > 0 ? formatEuro(predicted) : '—'}</TableCell>
      <TableCell className="text-right">{isPaid ? formatEuro(paid) : '—'}</TableCell>
      <TableCell>
        <Button
          size="sm"
          variant={isPaid ? 'outline' : 'default'}
          disabled={toggling}
          onClick={handleToggle}
          className={isPaid ? 'bg-success/15 text-success border-success/30 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/30 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-red-900/20 dark:hover:text-red-400 h-7 text-xs' : 'h-7 text-xs'}
        >
          {isPaid ? 'Pago ✓' : 'Confirmar'}
        </Button>
      </TableCell>
      <TableCell>
        {!isPaid && (
          <Input
            type="number"
            placeholder={predicted > 0 ? String(predicted) : '0.00'}
            value={value}
            onChange={e => setValue(e.target.value)}
            className="h-8 text-sm"
          />
        )}
      </TableCell>
      <TableCell>
        {!isPaid && value && (
          <Button size="sm" variant="ghost" disabled={saving} onClick={handleSave}>
            <Save className="h-3.5 w-3.5" />
          </Button>
        )}
      </TableCell>
    </TableRow>
  );
}
