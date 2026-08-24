export interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge?: string;
  gia?: string;
  ddd?: string;
  siafi?: string;
  erro?: boolean;
}

/**
 * Consulta CEP na API pública ViaCEP e retorna endereço estruturado.
 */
export async function fetchAddressByCEP(cepInput: string): Promise<ViaCEPResponse | null> {
  const clean = cepInput.replace(/\D/g, '');
  if (clean.length !== 8) {
    return null;
  }

  try {
    const res = await fetch(`https://viacep.com.br/ws/${clean}/json/`);
    if (!res.ok) return null;
    const data: ViaCEPResponse = await res.json();
    if (data.erro) return null;
    return data;
  } catch (err) {
    console.error('Erro ao consultar CEP:', err);
    return null;
  }
}

/**
 * Desmembra string de endereço completo em campos individuais (CEP, rua, número, bairro, cidade, UF)
 */
export function parseAddressString(addressStr?: string) {
  if (!addressStr) {
    return { cep: '', street: '', number: '', neighborhood: '', city: '', state: '' };
  }

  let cep = '';
  const cepMatch = addressStr.match(/CEP:?\s*([\d.-]+)/i);
  if (cepMatch) {
    cep = cepMatch[1].trim();
  }

  // Remove trecho do CEP
  const clean = addressStr.replace(/\(CEP:?[^)]*\)/i, '').trim();

  let state = '';
  let rest = clean;
  const stateMatch = clean.match(/-\s*([A-Za-z]{2})\s*$/);
  if (stateMatch) {
    state = stateMatch[1].trim().toUpperCase();
    rest = clean.replace(/-\s*[A-Za-z]{2}\s*$/, '').trim();
  }

  const parts = rest.split(',').map((p) => p.trim()).filter(Boolean);
  let street = '';
  let number = '';
  let neighborhood = '';
  let city = '';

  if (parts.length >= 4) {
    street = parts[0];
    number = parts[1];
    neighborhood = parts[2];
    city = parts.slice(3).join(', ');
  } else if (parts.length === 3) {
    street = parts[0];
    neighborhood = parts[1];
    city = parts[2];
  } else if (parts.length === 2) {
    street = parts[0];
    city = parts[1];
  } else if (parts.length === 1) {
    street = parts[0];
  }

  return { cep, street, number, neighborhood, city, state };
}

