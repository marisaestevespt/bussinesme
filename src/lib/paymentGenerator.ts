// Shared payment generator: creates commercial_sales entries for a project.
// Used by ProjectGestaoTab (manual generate) and ClienteDetail renewal flow.

import { format, parseISO, addMonths, setDate } from 'date-fns';
import type { TablesInsert } from '@/integrations/supabase/types';

export type PaymentEntry = TablesInsert<'commercial_sales'>;

export interface PaymentGenInput {
  payMethod: string; // 'pagamento_total' | 'entrada_prestacoes' | 'prestacoes' | 'avenca_mensal'
  startDate: string; // 'yyyy-MM-dd'
  deadline?: string | null;
  totalValue?: string | number;
  entradaValue?: string | number;
  numPrestacoes?: string | number;
  payDay?: string | number;
  numMeses?: string | number;
  avencaValue?: string | number;
  paymentMethodType?: string | null;
  entradaPaymentMethod?: string | null;
  prestacoesPaymentMethod?: string | null;
  product: string;
  client: string;
  projectId: string;
  vatRate?: number;
  createdBy?: string | null;
  filterFromCurrentMonth?: boolean; // default true in ProjectGestaoTab — for renewals set false
}

export function buildPaymentEntries(input: PaymentGenInput): PaymentEntry[] {
  const {
    payMethod, startDate, deadline,
    totalValue, entradaValue, numPrestacoes, payDay, numMeses, avencaValue,
    paymentMethodType, entradaPaymentMethod, prestacoesPaymentMethod,
    product, client, projectId, vatRate = 0, createdBy = null,
    filterFromCurrentMonth = true,
  } = input;

  if (!startDate) throw new Error('Data de início obrigatória');
  const start = parseISO(startDate);
  const applyVat = (base: number) => Math.round(base * (1 + vatRate / 100) * 100) / 100;
  const year = new Date().getFullYear();
  let saleCounter = 0;
  const genSaleId = () => { saleCounter++; return `V${year}-${Date.now()}-${saleCounter}`; };

  const getMethodForEntry = (isEntrada: boolean) => {
    if (payMethod === 'entrada_prestacoes') {
      return isEntrada ? (entradaPaymentMethod || paymentMethodType || null) : (prestacoesPaymentMethod || paymentMethodType || null);
    }
    return paymentMethodType || null;
  };

  const baseEntry = (overrides: Partial<PaymentEntry>): PaymentEntry => ({
    status: 'aguarda_pagamento',
    product,
    client,
    source: 'projeto',
    project_id: projectId,
    created_by: createdBy,
    ...overrides,
  } as PaymentEntry);

  const entries: PaymentEntry[] = [];

  if (payMethod === 'pagamento_total') {
    const val = Number(totalValue);
    if (!val || val <= 0) throw new Error('Valor inválido');
    entries.push(baseEntry({
      sale_id: genSaleId(),
      payment_date: format(start, 'yyyy-MM-dd'),
      description: `Pagamento Total — ${product}`,
      base_value: val,
      invoice_total: applyVat(val),
      sale_month: start.getMonth() + 1,
      sale_year: start.getFullYear(),
      sale_quarter: Math.ceil((start.getMonth() + 1) / 3),
      payment_method: getMethodForEntry(false),
    }));
  } else if (payMethod === 'entrada_prestacoes') {
    const total = Number(totalValue);
    const entrada = Number(entradaValue);
    const nPrest = Number(numPrestacoes);
    const day = Number(payDay);
    if (!total || !entrada || !nPrest || !day) throw new Error('Preencha todos os campos');
    if (entrada >= total) throw new Error('Valor de entrada deve ser inferior ao total');

    entries.push(baseEntry({
      sale_id: genSaleId(),
      payment_date: format(start, 'yyyy-MM-dd'),
      description: `Entrada — ${product}`,
      base_value: entrada,
      invoice_total: applyVat(entrada),
      sale_month: start.getMonth() + 1,
      sale_year: start.getFullYear(),
      sale_quarter: Math.ceil((start.getMonth() + 1) / 3),
      payment_method: getMethodForEntry(true),
    }));

    const restante = total - entrada;
    const valorPrestacao = Math.round((restante / nPrest) * 100) / 100;
    for (let i = 0; i < nPrest; i++) {
      const prestDate = setDate(addMonths(start, i + 1), day);
      const val = i === nPrest - 1 ? Math.round((restante - valorPrestacao * (nPrest - 1)) * 100) / 100 : valorPrestacao;
      entries.push(baseEntry({
        sale_id: genSaleId(),
        payment_date: format(prestDate, 'yyyy-MM-dd'),
        description: `Prestação ${i + 1}/${nPrest} — ${product}`,
        base_value: val,
        invoice_total: applyVat(val),
        sale_month: prestDate.getMonth() + 1,
        sale_year: prestDate.getFullYear(),
        sale_quarter: Math.ceil((prestDate.getMonth() + 1) / 3),
        payment_method: getMethodForEntry(false),
      }));
    }
  } else if (payMethod === 'prestacoes') {
    const total = Number(totalValue);
    const nPrest = Number(numPrestacoes);
    const day = Number(payDay);
    if (!total || !nPrest || !day) throw new Error('Preencha todos os campos');
    const valorPrestacao = Math.round((total / nPrest) * 100) / 100;
    for (let i = 0; i < nPrest; i++) {
      const prestDate = i === 0 ? start : setDate(addMonths(start, i), day);
      const val = i === nPrest - 1 ? Math.round((total - valorPrestacao * (nPrest - 1)) * 100) / 100 : valorPrestacao;
      entries.push(baseEntry({
        sale_id: genSaleId(),
        payment_date: format(prestDate, 'yyyy-MM-dd'),
        description: `Prestação ${i + 1}/${nPrest} — ${product}`,
        base_value: val,
        invoice_total: applyVat(val),
        sale_month: prestDate.getMonth() + 1,
        sale_year: prestDate.getFullYear(),
        sale_quarter: Math.ceil((prestDate.getMonth() + 1) / 3),
        payment_method: getMethodForEntry(false),
      }));
    }
  } else if (payMethod === 'avenca_mensal') {
    const meses = Number(numMeses);
    const day = Number(payDay);
    const valor = Number(avencaValue);
    if (!meses || !day || !valor) throw new Error('Preencha todos os campos');

    for (let i = 0; i < meses; i++) {
      const avDate = i === 0 ? start : setDate(addMonths(start, i), day);
      entries.push(baseEntry({
        sale_id: genSaleId(),
        payment_date: format(avDate, 'yyyy-MM-dd'),
        description: `Avença Mensal ${i + 1}/${meses} — ${product}`,
        base_value: valor,
        invoice_total: applyVat(valor),
        sale_month: avDate.getMonth() + 1,
        sale_year: avDate.getFullYear(),
        sale_quarter: Math.ceil((avDate.getMonth() + 1) / 3),
        payment_method: getMethodForEntry(false),
      }));
    }

    // Pro-rata
    if (deadline) {
      const endDate = parseISO(deadline);
      const lastPayDate = setDate(addMonths(start, meses - 1), day);
      if (endDate > lastPayDate) {
        const proRataStart = day;
        const endDay = endDate.getDate();
        const daysInEndMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0).getDate();
        const proRataDays = endDay >= proRataStart ? endDay - proRataStart + 1 : endDay;
        if (proRataDays > 0 && proRataDays < daysInEndMonth) {
          const proRataValue = Math.round((valor / daysInEndMonth) * proRataDays * 100) / 100;
          const proRataPayDate = new Date(endDate.getFullYear(), endDate.getMonth(), proRataStart);
          entries.push(baseEntry({
            sale_id: genSaleId(),
            payment_date: format(proRataPayDate, 'yyyy-MM-dd'),
            description: `Avença Mensal (pro-rata ${proRataDays}d) — ${product}`,
            base_value: proRataValue,
            invoice_total: applyVat(proRataValue),
            sale_month: proRataPayDate.getMonth() + 1,
            sale_year: proRataPayDate.getFullYear(),
            sale_quarter: Math.ceil((proRataPayDate.getMonth() + 1) / 3),
            payment_method: getMethodForEntry(false),
          }));
        }
      }
    }
  } else {
    throw new Error('Método de pagamento não suportado para geração automática');
  }

  if (entries.length === 0) throw new Error('Nenhuma entrada gerada');

  if (filterFromCurrentMonth) {
    const currentMonthStart = new Date();
    currentMonthStart.setDate(1);
    currentMonthStart.setHours(0, 0, 0, 0);
    return entries.filter((entry) => entry.payment_date != null && parseISO(entry.payment_date) >= currentMonthStart);
  }
  return entries;
}
