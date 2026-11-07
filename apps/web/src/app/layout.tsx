import type { Metadata, Viewport } from 'next';
import { Barlow, Barlow_Condensed } from 'next/font/google';
import { Provedores } from '@/componentes/provedores';
import { URL_SITE } from '@/lib/site';
import { SCRIPT_TEMA } from '@/lib/tema';
import './globals.css';

const barlow = Barlow({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-barlow',
  display: 'swap',
});
const barlowCondensed = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-barlow-condensed',
  display: 'swap',
});

export const metadata: Metadata = {
  title: { default: 'Pente Fino', template: '%s · Pente Fino' },
  description: 'Gestão de barbearia: saiba quanto sobra, não só quanto entrou.',
  applicationName: 'Pente Fino',
  metadataBase: new URL(URL_SITE),
  openGraph: { type: 'website', locale: 'pt_BR', siteName: 'Pente Fino' },
  twitter: { card: 'summary_large_image' },
  appleWebApp: { capable: true, title: 'Pente Fino', statusBarStyle: 'black-translucent' },
  icons: {
    icon: [
      { url: '/icon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico', sizes: '16x16 32x32 48x48' },
    ],
    apple: '/icones/apple-touch-icon.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#0b0b0b',
  viewportFit: 'cover',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${barlow.variable} ${barlowCondensed.variable} antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-dvh">
        <Provedores>{children}</Provedores>
      </body>
    </html>
  );
}
