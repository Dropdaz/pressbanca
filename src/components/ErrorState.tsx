import type { AppErrorView } from '@/core/errors';
import { Message, RateLimited } from './States';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function ErrorState({ error, game, region }: { error: AppErrorView; game: string; region: string }) {
  switch (error.kind) {
    case 'not-found':
      return <Message eyebrow="No encontrado" title="No hemos encontrado esto." body={`Riot no tiene datos de ${error.query}.`} />;
    case 'rate-limited':
      return <RateLimited retryAfterSec={error.retryAfterSec} />;
    case 'coming-soon':
      return <Message eyebrow="Próximamente" title={`${error.game} llegará pronto.`} body="Por ahora solo funciona League of Legends." />;
    default:
      return <Message eyebrow="Algo ha fallado" title="Se nos perdió el rastro." body={error.message} />;
  }
}
