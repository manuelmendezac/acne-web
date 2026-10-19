import type { ReactNode } from 'react';

import { Wordmark } from '@/components/brand/wordmark';

export const metadata = {
  title: 'Captura de fotografías',
  description: 'Captura de fotografías clínicas desde el teléfono mediante código QR.',
};

/**
 * Layout of the phone capture page.
 *
 * Outside the portals because there is no session: the phone is authorised by the QR token alone,
 * which the technician or the dermatologist scans from the case file.
 */
export default function CapturaLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <Wordmark size="sm" subtitle="Captura de fotografías" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-5">{children}</main>
    </div>
  );
}
