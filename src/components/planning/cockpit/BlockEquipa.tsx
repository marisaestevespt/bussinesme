import { KPRsInline } from './KPRsInline';

export function BlockEquipa({ year, month }: { year: number; month: number }) {
  return <KPRsInline area="equipa" year={year} month={month} />;
}