export class PlayerNotFoundError extends Error {
  readonly kind = 'not-found' as const;
  constructor(public query: string) {
    super(`Jugador no encontrado: ${query}`);
  }
}

export class RateLimitError extends Error {
  readonly kind = 'rate-limited' as const;
  constructor(public retryAfterSec: number) {
    super(`Límite de peticiones, reintenta en ${retryAfterSec} s`);
  }
}

export class UpstreamError extends Error {
  readonly kind = 'upstream' as const;
  constructor(public status: number, message: string) {
    super(message);
  }
}

export type AppErrorView =
  | { kind: 'not-found'; query: string }
  | { kind: 'rate-limited'; retryAfterSec: number }
  | { kind: 'upstream'; message: string }
  | { kind: 'coming-soon'; game: string };

export function toErrorView(e: unknown): AppErrorView {
  if (e instanceof PlayerNotFoundError) return { kind: 'not-found', query: e.query };
  if (e instanceof RateLimitError) return { kind: 'rate-limited', retryAfterSec: e.retryAfterSec };
  if (e instanceof UpstreamError) return { kind: 'upstream', message: e.message };
  console.error(e);
  return { kind: 'upstream', message: 'Algo falló al leer los datos de la partida.' };
}
