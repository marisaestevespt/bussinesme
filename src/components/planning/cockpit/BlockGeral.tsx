import { KPRsInline } from './KPRsInline';

export function BlockGeral({ year, month }: { year: number; month: number }) {
  return <KPRsInline area="geral" year={year} month={month} />;
}