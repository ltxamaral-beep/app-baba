import type { FinancialTransaction } from '@/types';

type FinancialStatementPdfInput = {
  groupName: string;
  periodLabel: string;
  periodType: 'monthly' | 'yearly';
  year: number;
  month?: number;
  transactions: FinancialTransaction[];
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const statusLabels: Record<FinancialTransaction['status'], string> = {
  paid: 'Pago',
  pending: 'Pendente',
  overdue: 'Em atraso',
  cancelled: 'Cancelado',
};

function formatDate(value?: string) {
  if (!value) return '-';
  const datePart = value.slice(0, 10);
  const [year, month, day] = datePart.split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function categoryLabel(category: string) {
  return category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function safeFilePart(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

export async function downloadFinancialStatementPdf(input: FinancialStatementPdfInput) {
  const [{ jsPDF }, { autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const orderedTransactions = [...input.transactions].sort((a, b) => {
    const aDate = a.dueDate || a.paidAt || a.createdAt || '';
    const bDate = b.dueDate || b.paidAt || b.createdAt || '';
    return bDate.localeCompare(aDate);
  });
  const paidIncome = orderedTransactions
    .filter((transaction) => transaction.type === 'income' && transaction.status === 'paid')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const paidExpenses = orderedTransactions
    .filter((transaction) => transaction.type === 'expense' && transaction.status === 'paid')
    .reduce((total, transaction) => total + transaction.amount, 0);
  const pendingIncome = orderedTransactions
    .filter((transaction) => transaction.type === 'income' && ['pending', 'overdue'].includes(transaction.status))
    .reduce((total, transaction) => total + transaction.amount, 0);
  const netBalance = paidIncome - paidExpenses;

  const document = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = document.internal.pageSize.getWidth();
  const generatedAt = new Date().toLocaleString('pt-BR');

  document.setFillColor(9, 15, 22);
  document.rect(0, 0, pageWidth, 34, 'F');
  document.setTextColor(255, 255, 255);
  document.setFont('helvetica', 'bold');
  document.setFontSize(19);
  document.text('Extrato Financeiro', 14, 14);
  document.setFontSize(11);
  document.text(input.groupName || 'Grupo', 14, 22);
  document.setFont('helvetica', 'normal');
  document.setTextColor(173, 190, 205);
  document.setFontSize(9);
  document.text(`Periodo: ${input.periodLabel}`, 14, 29);
  document.text(`Gerado em: ${generatedAt}`, pageWidth - 14, 29, { align: 'right' });

  const summary = [
    { label: 'Receitas pagas', value: paidIncome, color: [0, 180, 159] as [number, number, number] },
    { label: 'Despesas pagas', value: paidExpenses, color: [244, 63, 94] as [number, number, number] },
    { label: 'A receber', value: pendingIncome, color: [245, 158, 11] as [number, number, number] },
    { label: 'Saldo do periodo', value: netBalance, color: (netBalance >= 0 ? [0, 180, 159] : [244, 63, 94]) as [number, number, number] },
  ];
  const boxGap = 4;
  const boxWidth = (pageWidth - 28 - boxGap * 3) / 4;
  summary.forEach((item, index) => {
    const x = 14 + index * (boxWidth + boxGap);
    document.setFillColor(242, 246, 249);
    document.roundedRect(x, 40, boxWidth, 20, 2, 2, 'F');
    document.setFont('helvetica', 'normal');
    document.setTextColor(80, 96, 110);
    document.setFontSize(8);
    document.text(item.label.toUpperCase(), x + 4, 47);
    document.setFont('helvetica', 'bold');
    document.setTextColor(...item.color);
    document.setFontSize(13);
    document.text(currencyFormatter.format(item.value), x + 4, 56);
  });

  const body = orderedTransactions.length > 0
    ? orderedTransactions.map((transaction) => [
        formatDate(transaction.dueDate || transaction.paidAt || transaction.createdAt),
        transaction.type === 'income' ? 'Receita' : 'Despesa',
        categoryLabel(transaction.category),
        transaction.description || '-',
        transaction.userName || 'Grupo',
        statusLabels[transaction.status] || transaction.status,
        `${transaction.type === 'expense' ? '- ' : ''}${currencyFormatter.format(transaction.amount)}`,
      ])
    : [['-', '-', '-', 'Nenhum lancamento encontrado no periodo selecionado.', '-', '-', '-']];

  autoTable(document, {
    startY: 67,
    head: [['Data', 'Tipo', 'Categoria', 'Descricao', 'Atleta/Origem', 'Status', 'Valor']],
    body,
    theme: 'grid',
    margin: { left: 14, right: 14, bottom: 16 },
    styles: {
      font: 'helvetica',
      fontSize: 8,
      cellPadding: 2.4,
      lineColor: [218, 226, 233],
      lineWidth: 0.15,
      textColor: [31, 41, 55],
      valign: 'middle',
    },
    headStyles: {
      fillColor: [0, 180, 159],
      textColor: [9, 15, 22],
      fontStyle: 'bold',
    },
    alternateRowStyles: { fillColor: [247, 250, 252] },
    columnStyles: {
      0: { cellWidth: 23 },
      1: { cellWidth: 20 },
      2: { cellWidth: 34 },
      4: { cellWidth: 36 },
      5: { cellWidth: 24 },
      6: { cellWidth: 30, halign: 'right', fontStyle: 'bold' },
    },
  });

  const totalPages = document.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    document.setPage(page);
    const pageHeight = document.internal.pageSize.getHeight();
    document.setDrawColor(218, 226, 233);
    document.line(14, pageHeight - 10, pageWidth - 14, pageHeight - 10);
    document.setFont('helvetica', 'normal');
    document.setFontSize(7.5);
    document.setTextColor(100, 116, 130);
    document.text('Reis da Pelada - Extrato financeiro do periodo selecionado', 14, pageHeight - 5.5);
    document.text(`Pagina ${page} de ${totalPages}`, pageWidth - 14, pageHeight - 5.5, { align: 'right' });
  }

  const periodFilePart = input.periodType === 'monthly'
    ? `${input.year}-${String(input.month || 1).padStart(2, '0')}`
    : String(input.year);
  document.save(`extrato-${safeFilePart(input.groupName || 'grupo')}-${periodFilePart}.pdf`);
}
