import { useState } from 'react';
import { cn } from '@/lib/utils';
import { FinAuditoriaPagamentos } from './FinAuditoriaPagamentos';
import { FinAuditoriaFornecedores } from './FinAuditoriaFornecedores';
import { FinAuditoriaVendas } from './FinAuditoriaVendas';
import { FinAuditoriaDocumentos } from './FinAuditoriaDocumentos';

const SUBS = [
  { key: 'pagamentos' as const, label: 'Pagamentos a Membros' },
  { key: 'fornecedores' as const, label: 'Fornecedores' },
  { key: 'vendas' as const, label: 'Vendas / Entradas' },
  { key: 'documentos' as const, label: 'Documentos' },
];

export function FinAuditoria() {
  const [sub, setSub] = useState<typeof SUBS[number]['key']>('pagamentos');
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Auditoria Financeira</h2>
        <p className="text-sm text-muted-foreground">
          Verifica a integridade das ligações entre o financeiro e os módulos relacionados, e sinaliza pagamentos em atraso.
        </p>
      </div>
      <div className="flex gap-2 flex-wrap">
        {SUBS.map(s => (
          <button
            key={s.key}
            onClick={() => setSub(s.key)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              sub === s.key
                ? 'bg-primary text-primary-foreground'
                : 'bg-background border border-secondary text-secondary-foreground hover:bg-muted',
            )}
          >
            {s.label}
          </button>
        ))}
      </div>
      {sub === 'pagamentos' && <FinAuditoriaPagamentos />}
      {sub === 'fornecedores' && <FinAuditoriaFornecedores />}
      {sub === 'vendas' && <FinAuditoriaVendas />}
      {sub === 'documentos' && <FinAuditoriaDocumentos />}
    </div>
  );
}