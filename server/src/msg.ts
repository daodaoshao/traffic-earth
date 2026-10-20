/**
 * The server never sends user-facing text: errors and statuses are codes with parameters,
 * and the browser renders them in the viewer's language.
 */
export interface Msg {
  code: string;
  params?: Record<string, string | number>;
}

export class AppError extends Error {
  constructor(
    public code: string,
    public params: Record<string, string | number> = {},
    public statusCode = 400,
  ) {
    super(code);
  }
}

export function toMsg(e: any): Msg {
  if (e instanceof AppError) return { code: e.code, params: e.params };
  if (e?.name === 'TimeoutError') return { code: 'timeout' };
  return { code: 'network', params: { detail: String(e?.cause?.code ?? e?.message ?? e) } };
}

export type Lang = 'zh' | 'en';
export const asLang = (v: unknown): Lang => (v === 'en' ? 'en' : 'zh');
