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
