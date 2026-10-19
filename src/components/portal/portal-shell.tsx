'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { Sidebar } from '@/components/portal/sidebar';
import { Topbar } from '@/components/portal/topbar';
import { useSession } from '@/components/session-provider';
import { Alert, Loading } from '@/components/ui/feedback';
import { cn } from '@/lib/cn';
import { PORTALS, mayOpen, portalForRole, portalHref, type PortalSlug } from '@/lib/portals';

const COLLAPSED_STORAGE_KEY = 'acne.sidebarCollapsed';

/**
 * The chrome shared by the three portals, and the boundary between them.
 *
 * It answers three questions in order, and the order matters:
 *
 *  1. Is there a session at all? No → `/login`.
 *  2. Is this the caller's portal? No → send them to theirs, silently. A dermatologist who
 *     bookmarked `/admin/usuarios` gets `/dermatologo`, not a scolding: they did nothing wrong and
 *     an error screen would only teach them that the system is unreliable.
 *  3. Does this portal own the route? No → an explicit notice. This one IS worth naming, because
 *     it means a link inside the product pointed somewhere the portal does not have, and silence
 *     would hide the bug.
 *
 * None of this is security. The API refuses every route by role regardless (RF-TR-02); this exists
 * so a wrong URL reads as a boundary rather than as a screen full of failed requests.
 */
export function PortalShell({ slug, children }: { slug: PortalSlug; children: ReactNode }) {
  const portal = PORTALS[slug];
  const { user, loading } = useSession();
  const router = useRouter();
  const pathname = usePathname() ?? '';

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const ownPortal = portalForRole(user?.role);
  const wrongPortal = user !== null && ownPortal !== null && ownPortal.slug !== slug;

  useEffect(() => {
    if (loading) return;
    if (user === null) {
      router.replace('/login');
      return;
    }
    if (ownPortal === null) {
      // A role no portal claims. It cannot happen with the three roles the system has, and if it
      // ever does, dropping the user at login is the only honest answer: there is nowhere to send
      // them, and rendering an empty shell would look like a system that lost their data.
      router.replace('/login');
      return;
    }
    if (ownPortal.slug !== slug) router.replace(portalHref(ownPortal.slug));
  }, [loading, user, ownPortal, slug, router]);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true');
    } catch {
      // Blocked storage: the sidebar simply starts expanded every time.
    }
  }, []);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        /* the preference just will not persist */
      }
      return next;
    });
  }, []);

  if (loading) return <Loading label="Verificando sesión…" />;
  if (user === null || wrongPortal) return null;

  return (
    <div className="min-h-screen bg-neutral-50">
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* The rail is fixed, so the content pane is offset by its width. */}
      <div className={cn('transition-[padding] duration-200', collapsed ? 'lg:pl-16' : 'lg:pl-64')}>
        <Topbar onOpenMobileMenu={() => setMobileOpen(true)} />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          {mayOpen(portal, pathname) ? (
            children
          ) : (
            <Alert tone="warning" title="Sección no disponible en este portal">
              {portal.label} no incluye esta sección. Si necesita llegar a ella, solicítelo al
              administrador del estudio.
            </Alert>
          )}
        </main>
      </div>
    </div>
  );
}
