import { FinancialTransaction } from '@/types';

export const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export type FinancePeriodType = 'all' | 'monthly' | 'yearly';

/**
 * Filtra transação financeira pelo período selecionado (Geral, Mensal ou Anual)
 */
export function matchTransactionPeriod(
  t: FinancialTransaction,
  periodType: FinancePeriodType,
  year: number,
  month: number // 1 a 12
): boolean {
  if (!t || periodType === 'all') return true;

  const validMonth = typeof month === 'number' && month >= 1 && month <= 12 ? month : 1;
  const validYear = typeof year === 'number' && year > 2000 ? year : new Date().getFullYear();

  const targetDateStr = t.dueDate || t.paidAt || t.createdAt || '';
  const monthName = (MONTH_NAMES[validMonth - 1] || '').toLowerCase();
  const monthPad = String(validMonth).padStart(2, '0');
  const yearStr = String(validYear);

  if (periodType === 'yearly') {
    if (targetDateStr && targetDateStr.startsWith(yearStr)) return true;
    if (t.description && t.description.includes(yearStr)) return true;
    return false;
  }

  if (periodType === 'monthly') {
    // 1. Data no formato YYYY-MM
    const yearMonthPrefix = `${yearStr}-${monthPad}`;
    if (targetDateStr && targetDateStr.startsWith(yearMonthPrefix)) return true;

    // 2. Descrição contendo nome do mês e ano
    const descLower = (t.description || '').toLowerCase();
    if (monthName && descLower.includes(monthName)) {
      if (descLower.includes(yearStr) || (targetDateStr && targetDateStr.startsWith(yearStr))) {
        return true;
      }
    }

    return false;
  }

  return true;
}

/**
 * Retorna lista de anos disponíveis baseada nas transações cadastradas
 */
export function getAvailableYears(transactions?: FinancialTransaction[]): number[] {
  const currentYear = new Date().getFullYear();
  const yearsSet = new Set<number>([currentYear, currentYear - 1]);

  if (Array.isArray(transactions)) {
    transactions.forEach((t) => {
      const d = t?.dueDate || t?.paidAt || t?.createdAt;
      if (d && typeof d === 'string' && d.length >= 4) {
        const parsedYear = parseInt(d.substring(0, 4), 10);
        if (!isNaN(parsedYear) && parsedYear >= 2020 && parsedYear <= 2035) {
          yearsSet.add(parsedYear);
        }
      }
    });
  }

  return Array.from(yearsSet).sort((a, b) => b - a);
}
