'use client';

import { PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { BrandMark } from '@/components/brand/brand-mark';
import { Wordmark } from '@/components/brand/wordmark';
import { cn } from '@/lib/cn';
import { isActive, portalHref } from '@/lib/portals';
import { usePortal } from '@/lib/use-portal';

/**
 * Portal sidebar: a dark rail with the product's mark and the sections of this portal.
 *
 * Collapses to an icon rail on desktop and becomes a drawer on mobile. Collapsed items keep a
 * `title` so the label is still reachable on hover — an icon rail with no way to recover the
 * meaning is a trap for an occasional user.
 *
 * The menu shows labels only. The study objectives and requirement codes each section serves are
 * still declared in `portals.ts` (Auditoría reads them), but a clinician's navigation is not the
 * place to cite them.
 */
export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}) {
  const pathname = usePathname();
  // Each portal declares the sections it has, and a role only ever reaches its own portal, so
  // nothing here is filtered by role at render time (RF-TR-02).
  const { portal } = usePortal();
  const groups = portal.groups;

  // The drawer is always rendered expanded: collapsing is a desktop space trade-off, and an icon
  // rail inside an overlay that already covers the screen would only make it harder to read.
  const renderContent = (collapsed: boolean) => (
    <>
      <div
        className={cn(
          'flex h-16 shrink-0 items-center border-b border-white/10 px-4',
          collapsed && 'justify-center px-0',
        )}
      >
        {collapsed ? (
          <BrandMark className="h-8 w-8" />
        ) : (
          // Which portal this is, not a tagline: the same chrome serves three of them and the
          // header is where someone confirms they are in the right one.
          <Wordmark size="sm" tone="dark" subtitle={portal.label} />
        )}

        <button
          type="button"
          onClick={onCloseMobile}
          className="ml-auto rounded-md p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white lg:hidden"
        >
          <X className="h-5 w-5" aria-hidden />
          <span className="sr-only">Cerrar menú</span>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group, groupIndex) => (
          <div key={group.title ?? `group-${groupIndex}`} className={groupIndex > 0 ? 'mt-6' : ''}>
            {group.title !== null && !collapsed ? (
              <p className="px-3 pb-2 text-xs font-medium text-neutral-500">{group.title}</p>
            ) : null}
            {group.title !== null && collapsed ? (
              <div className="mx-2 mb-3 border-t border-white/10" />
            ) : null}

            <ul className="space-y-1">
              {group.items.map((item) => {
                const active = isActive(portal, item, pathname ?? '');
                const Icon = item.icon;
                return (
                  <li key={item.path}>
                    <Link
                      href={portalHref(portal.slug, item.path)}
                      onClick={onCloseMobile}
                      aria-current={active ? 'page' : undefined}
                      title={collapsed ? item.label : undefined}
                      className={cn(
                        'group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400',
                        collapsed && 'justify-center px-0',
                        active
                          ? 'bg-white/10 font-medium text-white'
                          : 'text-neutral-400 hover:bg-white/5 hover:text-white',
                      )}
                    >
                      {active && !collapsed ? (
                        <span
                          aria-hidden
                          className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-purple-400"
                        />
                      ) : null}
                      <Icon
                        className={cn(
                          'h-4.5 w-4.5 shrink-0',
                          active ? 'text-purple-300' : 'text-neutral-500 group-hover:text-neutral-300',
                        )}
                        aria-hidden
                      />
                      {!collapsed ? <span className="truncate">{item.label}</span> : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            'hidden w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-neutral-500 transition-colors lg:flex',
            'hover:bg-white/5 hover:text-white',
            collapsed && 'justify-center px-0',
          )}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4.5 w-4.5" aria-hidden />
          ) : (
            <>
              <PanelLeftClose className="h-4.5 w-4.5" aria-hidden />
              <span>Colapsar</span>
            </>
          )}
          <span className="sr-only">{collapsed ? 'Expandir menú' : 'Colapsar menú'}</span>
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop rail */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 hidden flex-col bg-neutral-950 text-neutral-300 transition-[width] duration-200 lg:flex',
          collapsed ? 'w-16' : 'w-64',
        )}
      >
        {renderContent(collapsed)}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={onCloseMobile}
            className="absolute inset-0 bg-neutral-950/60"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 flex-col bg-neutral-950 text-neutral-300">
            {renderContent(false)}
          </aside>
        </div>
      ) : null}
    </>
  );
}
