import { Message } from '@/components/States';

export default function NotFoundPage() {
  return (
    <main className="wrap" style={{ paddingTop: 80, paddingBottom: 80 }}>
      <Message eyebrow="404" title="Fuera del mapa." body="Esta página no existe. Elige un perfil desde el inicio." />
    </main>
  );
}
