/**
 * Validação do Cadastro de Pessoas Físicas (CPF) Brasileiro
 * Calcula os dois dígitos verificadores reais pelo algoritmo módulo 11.
 */
export function validateCPF(cpf: string): boolean {
  if (!cpf) return false;
  const cleanCPF = cpf.replace(/\D/g, '');

  // O CPF deve ter exatamente 11 dígitos numéricos
  if (cleanCPF.length !== 11) return false;

  // Rejeita sequências de dígitos todos iguais (ex: 111.111.111-11, 000.000.000-00)
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  // Validação do 1º Dígito Verificador
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (10 - i);
  }
  let firstRemainder = (sum * 10) % 11;
  if (firstRemainder === 10 || firstRemainder === 11) firstRemainder = 0;
  if (firstRemainder !== parseInt(cleanCPF.charAt(9), 10)) return false;

  // Validação do 2º Dígito Verificador
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i), 10) * (11 - i);
  }
  let secondRemainder = (sum * 10) % 11;
  if (secondRemainder === 10 || secondRemainder === 11) secondRemainder = 0;
  if (secondRemainder !== parseInt(cleanCPF.charAt(10), 10)) return false;

  return true;
}
