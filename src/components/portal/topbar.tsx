'use client';

import { ChevronRight, Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { UserMenu } from '@/components/portal/user-menu';
import { pageTitleFor, portalHref } from '@/lib/portals';
import { usePortal } from '@/lib/use-portal';

/**
 * Top bar of the portal.
 *
 * Navigation lives in the sidebar, so this carries only what has to be visible on every screen:
 * where you are (a breadcrumb — the page itself owns the title, see `PageHeader`) and who you are.
 * The study phase is a property of each case and diagnosis, not of the person signed in, so it is
 * shown next to the case (`StudyModeBadge`) rather than here.
 */
export function Topbar({ onOpenMobileMenu }: { onOpenMobileMenu: () => void }) {
  const pathname = usePathname() ?? '';
  const { portal } = usePortal();

  const home = portalHref(portal.slug);
  const title = pageTitleFor(portal, pathname);
  const atHome = pathname === home;

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-neutral-200 bg-white px-4 sm:px-6 lg:px-8">
      <button
        type="button"
        onClick={onOpenMobileMenu}
        className="rounded-md p-2 text-neutral-500 hover:bg-neutral-100 lg:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
        <span className="sr-only">Abrir menú</span>
      </button>

      <nav aria-label="Ubicación" className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
        {atHome ? (
          <span className="truncate font-medium text-neutral-900">{portal.label}</span>
        ) : (
          <>
            <Link href={home} className="shrink-0 text-neutral-500 hover:text-neutral-900">
              {portal.label}
            </Link>
            <ChevronRight className="h-4 w-4 shrink-0 text-neutral-300" aria-hidden />
            <span className="truncate font-medium text-neutral-900">{title}</span>
          </>
        )}
      </nav>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <UserMenu />
      </div>
    </header>
  );
}
