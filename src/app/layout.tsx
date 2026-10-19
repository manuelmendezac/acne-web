import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';

import { SessionProvider } from '@/components/session-provider';
import { ToastProvider } from '@/components/ui/toast';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/constants';

import './globals.css';

/**
 * One family for the whole interface.
 *
 * Headings used to be Poppins, a geometric face whose round letterforms read as marketing beside a
 * table of thirty review times. The weight classes already sitting next to every heading carry the
 * hierarchy on their own, and one family is also one fewer font to download.
 *
 * Loaded with `next/font`, never with an `@import` in a stylesheet: the Tailwind-only policy of
 * section 12.3 forbids anything in `globals.css` beyond the directives, and `next/font` self-hosts
 * the files, which also keeps patient-facing pages from calling Google on load.
 */
const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: `${PRODUCT_TAGLINE} de acné. Herramienta de apoyo; no sustituye el juicio clínico del profesional médico.`,
  applicationName: PRODUCT_NAME,
  manifest: '/manifest.json',
  // The portal handles patient data: it must never be indexed.
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The interface is light-only, so this is one constant rather than a pair of values behind
  // `prefers-color-scheme`. It is what a phone paints its status bar with, and it matches the page
  // background so the two read as one surface.
  themeColor: '#fafafa',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es-PE" className={inter.variable}>
      <body className="min-h-screen bg-neutral-50 font-(family-name:--font-inter) text-neutral-900 antialiased">
        <SessionProvider>
          <ToastProvider>{children}</ToastProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
