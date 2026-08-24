// ---------------------------------------------------------------------------
// Helpers para Geração e Validação de UUIDs (compatíveis com PostgreSQL)
// ---------------------------------------------------------------------------
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function isValidUUID(id?: string): boolean {
  if (!id) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

// Helper seguro de timeout para consultas na nuvem
export async function withTimeout<T>(promise: PromiseLike<T>, ms: number, fallback: any): Promise<any> {
  let timer: any;
  const timeoutPromise = new Promise<T>((resolve) => {
    timer = setTimeout(() => resolve(fallback), ms);
  });
  try {
    const res = await Promise.race([Promise.resolve(promise), timeoutPromise]);
    clearTimeout(timer);
    return res;
  } catch {
    clearTimeout(timer);
    return fallback;
  }
}

// Helper de LocalStorage Seguro para SSR
export function getStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(`pelada_${key}`);
    return item ? JSON.parse(item) : fallback;
  } catch {
    return fallback;
  }
}

export function setStored<T>(key: string, data: T): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`pelada_${key}`, JSON.stringify(data));
  } catch (err) {
    console.error('Storage error:', err);
  }
}
