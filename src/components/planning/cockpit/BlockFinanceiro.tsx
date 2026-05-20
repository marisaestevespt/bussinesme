import { KPRsInline } from './KPRsInline';

export function BlockFinanceiro({ year, month }: { year: number; month: number }) {
  return <KPRsInline area="financeiro" year={year} month={month} />;
}