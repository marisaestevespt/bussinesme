import { KPRsInline } from './KPRsInline';

export function BlockProdutos({ year, month }: { year: number; month: number }) {
  return <KPRsInline area="produtos" year={year} month={month} />;
}