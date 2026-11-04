import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono, Outfit, Unbounded } from 'next/font/google';
import './globals.css';

const unbounded = Unbounded({ variable: '--font-unbounded', subsets: ['latin'], weight: ['500', '700', '800', '900'] });
const outfit = Outfit({ variable: '--font-outfit', subsets: ['latin'], weight: ['300', '400', '500', '600', '700'] });
const jetbrains = JetBrains_Mono({ variable: '--font-jetbrains', subsets: ['latin'], weight: ['400', '500', '700'] });

export const metadata: Metadata = {
  title: { default: 'PressBanca', template: '%s · PressBanca' },
  description: 'Tracker privado de League of Legends: historial de ranked, análisis de cada partida, MMR estimado y partidas en directo.',
};

export const viewport: Viewport = { themeColor: '#090B10' };

// Applied before paint so the stored theme never flashes.
const themeScript = `try{if(localStorage.getItem('pb-theme')==='light')document.documentElement.classList.add('light')}catch(e){}`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-game="lol" className={`${unbounded.variable} ${outfit.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true">
          <defs>
            <filter id="goo">
              <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="b" />
              <feColorMatrix in="b" mode="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 24 -10" />
            </filter>
          </defs>
        </svg>
        {children}
      </body>
    </html>
  );
}
