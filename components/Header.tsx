"use client";

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import UserMenu from './UserMenu';
import { useState, useEffect, useRef } from 'react';
import { ChevronDown, Menu as MenuIcon, X as XIcon } from 'lucide-react';
import { useAuth } from './AuthContext';
import Portal from './Portal';

type MenuKey = 'inventory' | 'admin' | 'deliveries' | 'production' | null;

export default function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, hasPermission, hasRole } = useAuth();
  // Single source of truth for which desktop dropdown is open
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Portal panel positioning
  const inventoryBtnRef = useRef<HTMLButtonElement | null>(null);
  const productionBtnRef = useRef<HTMLButtonElement | null>(null);
  const deliveriesBtnRef = useRef<HTMLButtonElement | null>(null);
  const adminBtnRef = useRef<HTMLButtonElement | null>(null);
  const [panelPos, setPanelPos] = useState<{ top: number; right: number } | null>(null);
  // Mobile menu state
  const [mobileOpen, setMobileOpen] = useState(false);
  // Prevent SSR/hydration mismatch: don't render auth-dependent nav until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // Horizontal scroll fades for main menu
  const navRef = useRef<HTMLDivElement | null>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);
  const updateFades = () => {
    const el = navRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setShowLeftFade(scrollLeft > 2);
    setShowRightFade(scrollLeft + clientWidth < scrollWidth - 2);
  };
  useEffect(() => {
    updateFades();
    const el = navRef.current;
    if (!el) return;
    const onScroll = () => updateFades();
    el.addEventListener('scroll', onScroll, { passive: true } as any);
    const onResize = () => updateFades();
    window.addEventListener('resize', onResize);
    const t = setTimeout(updateFades, 150);
    return () => {
      el.removeEventListener('scroll', onScroll as any);
      window.removeEventListener('resize', onResize);
      clearTimeout(t);
    };
  }, [mounted]);

  // Hide header on login page
  if (pathname === '/login') {
    return null;
  }

  // Close mobile + dropdown menus on route change
  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
  }, [pathname]);

  // Close dropdowns when clicking outside, pressing Escape, or scrolling
  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      // If the click didn't happen inside any .dropdown-menu container, close all
      if (!target?.closest('.dropdown-menu') && !target?.closest('[data-dropdown-portal="true"]')) {
        setOpenMenu(null);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpenMenu(null);
      }
    }
    function onScroll() {
      setOpenMenu(null);
    }
    document.addEventListener('mousedown', onDocMouseDown);
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      document.removeEventListener('mousedown', onDocMouseDown);
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', onScroll);
    };
  }, []);

  // Hover intent helpers (desktop)
  const scheduleOpen = (key: Exclude<MenuKey, null>) => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    // Open quickly for snappy feel
    hoverTimer.current = setTimeout(() => setOpenMenu(key), 60);
  };
  const scheduleClose = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    // Small delay to allow moving pointer from button into panel
    hoverTimer.current = setTimeout(() => setOpenMenu(null), 140);
  };

  // Compute portal panel position anchored to the right edge of the trigger button
  const computePanelPos = () => {
    if (!openMenu) {
      setPanelPos(null);
      return;
    }
    const refMap: Record<Exclude<MenuKey, null>, React.RefObject<HTMLButtonElement | null>> = {
      inventory: inventoryBtnRef,
      production: productionBtnRef,
      deliveries: deliveriesBtnRef,
      admin: adminBtnRef,
    } as const;
    const btn = refMap[openMenu]?.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const top = rect.bottom + 8; // 8px gap like mt-2
    const right = Math.max(8, window.innerWidth - rect.right); // keep at least 8px from right edge
    setPanelPos({ top, right });
  };

  // Recompute position when menu opens, on scroll, and on resize
  useEffect(() => {
    computePanelPos();
    if (!openMenu) return;
    const onScroll = () => computePanelPos();
    const onResize = () => computePanelPos();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    const navEl = navRef.current;
    navEl?.addEventListener('scroll', onScroll, { passive: true } as any);
    const t = setTimeout(computePanelPos, 0);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      navEl?.removeEventListener('scroll', onScroll as any);
      clearTimeout(t);
    };
  }, [openMenu]);

  // Check if user can see admin features
  const isAdminLike = !!(
    hasRole?.('admin') ||
    hasRole?.('system_admin') ||
    hasPermission?.('roles:read') // permission-based fallback
  );
  const canScheduleProduction = !!(
    hasPermission?.('production:create') || isAdminLike
  );

  return (
    <header className="sticky top-0 z-30 relative backdrop-blur bg-white/80 border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3">
          <img
            src="/Untitled.png"
            alt="TIC Logo"
            className="h-16 w-auto"
          />
        </Link>

        {/* Mobile toggle */}
        {isAuthenticated && (
          <button
            className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <XIcon className="h-6 w-6" /> : <MenuIcon className="h-6 w-6" />}
          </button>
        )}

        {/* Desktop nav */}
  <nav ref={navRef} className="relative hidden md:flex flex-1 items-center justify-end space-x-4 text-sm text-gray-700 overflow-x-auto overflow-y-visible whitespace-nowrap pr-2 snap-x snap-proximity">
          {/* Left fade */}
          {showLeftFade && (
            <div className="pointer-events-none absolute left-0 top-0 h-full w-6 bg-gradient-to-r from-white to-transparent" aria-hidden="true" />)
          }
          {!mounted ? (
            <span className="text-gray-400">Loading…</span>
          ) : isAuthenticated && user ? (
            <>
              <span className="text-gray-900 font-medium">
                Hello, {user.firstName}
              </span>
              <span className="text-gray-300">·</span>

              {/* Store Stocktake */}
              <Link href="/" className="shrink-0 snap-start font-medium px-2 py-1 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors">Store Stocktake</Link>
              <span className="text-gray-300">·</span>

              {/* Inventory Dropdown */}
              <div
                className="relative dropdown-menu"
                onMouseEnter={() => scheduleOpen('inventory')}
                onMouseLeave={scheduleClose}
              >
                <button
                  ref={inventoryBtnRef}
                  onClick={() => setOpenMenu((m) => (m === 'inventory' ? null : 'inventory'))}
                  aria-expanded={openMenu === 'inventory'}
                  className={`shrink-0 snap-start group font-medium flex items-center gap-1 px-2 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${openMenu === 'inventory' ? 'text-gray-900 bg-gray-100' : 'hover:bg-gray-100 hover:text-gray-900'}`}
                >
                  Inventory
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openMenu === 'inventory' ? 'rotate-180' : 'group-hover:rotate-180'}`} />
                </button>
                {openMenu === 'inventory' && panelPos && (
                  <Portal>
                    <div
                      data-dropdown-portal="true"
                      onMouseEnter={() => scheduleOpen('inventory')}
                      onMouseLeave={scheduleClose}
                      className="min-w-[16rem] lg:min-w-[20rem] max-w-[90vw] max-h-[70vh] overflow-auto bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50 origin-top animate-in fade-in"
                      style={{ position: 'fixed', top: panelPos.top, right: panelPos.right }}
                    >
                      <div className="py-1">
                        {hasPermission?.('stocktakes:read') && (
                          <Link href="/inventory" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                            📊 Main Inventory
                          </Link>
                        )}
                        {hasPermission?.('stocktakes:create') && (
                          <Link href="/factory/intake" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                            🏭 Incoming Stock (Factory)
                          </Link>
                        )}
                        {/* Master Snapshot link removed (tucked under Factory Advanced) */}
                        {hasPermission?.('stocktakes:create') && (
                          <Link href="/store/adjust" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                            ➕ Adjust Stock
                          </Link>
                        )}
                        {hasPermission?.('stocktakes:read') && (
                          <Link href="/stocktakes" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                            📝 Stocktakes
                          </Link>
                        )}
                        <Link href="/orders" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                          📦 Orders & Supplies
                        </Link>
                      </div>
                    </div>
                  </Portal>
                )}
              </div>
              <span className="text-gray-300">·</span>

              {/* Production Dropdown */}
              <div
                className="relative dropdown-menu"
                onMouseEnter={() => scheduleOpen('production')}
                onMouseLeave={scheduleClose}
              >
                <button
                  ref={productionBtnRef}
                  onClick={() => setOpenMenu((m) => (m === 'production' ? null : 'production'))}
                  aria-expanded={openMenu === 'production'}
                  className={`shrink-0 snap-start group font-medium flex items-center gap-1 px-2 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${openMenu === 'production' ? 'text-gray-900 bg-gray-100' : 'hover:bg-gray-100 hover:text-gray-900'}`}
                >
                  Production
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openMenu === 'production' ? 'rotate-180' : 'group-hover:rotate-180'}`} />
                </button>
                {openMenu === 'production' && panelPos && (
                  <Portal>
                    <div
                      data-dropdown-portal="true"
                      onMouseEnter={() => scheduleOpen('production')}
                      onMouseLeave={scheduleClose}
                      className="min-w-[16rem] lg:min-w-[20rem] max-w-[90vw] max-h-[70vh] overflow-auto bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50 origin-top animate-in fade-in"
                      style={{ position: 'fixed', top: panelPos.top, right: panelPos.right }}
                    >
                      <div className="py-1">
                        <Link href="/factory" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                          🏭 Factory Dashboard
                        </Link>
                        <Link href="/factory/production" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                          🧰 Today’s Production
                        </Link>
                        <Link href="/factory/production-planning" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                          🛠️ Production Planning
                        </Link>
                        {canScheduleProduction && (
                          <Link href="/admin/production-schedule" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                            🗓️ Schedule Production
                          </Link>
                        )}
                        <Link href="/production/analytics" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                          📈 Production Analytics
                        </Link>
                      </div>
                    </div>
                  </Portal>
                )}
              </div>
              <span className="text-gray-300">·</span>

              {/* Deliveries Dropdown */}
              <div
                className="relative dropdown-menu"
                onMouseEnter={() => scheduleOpen('deliveries')}
                onMouseLeave={scheduleClose}
              >
                <button
                  ref={deliveriesBtnRef}
                  onClick={() => setOpenMenu((m) => (m === 'deliveries' ? null : 'deliveries'))}
                  aria-expanded={openMenu === 'deliveries'}
                  className={`shrink-0 snap-start group font-medium flex items-center gap-1 px-2 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${openMenu === 'deliveries' ? 'text-gray-900 bg-gray-100' : 'hover:bg-gray-100 hover:text-gray-900'}`}
                >
                  Deliveries
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openMenu === 'deliveries' ? 'rotate-180' : 'group-hover:rotate-180'}`} />
                </button>
                {openMenu === 'deliveries' && panelPos && (
                  <Portal>
                    <div
                      data-dropdown-portal="true"
                      onMouseEnter={() => scheduleOpen('deliveries')}
                      onMouseLeave={scheduleClose}
                      className="min-w-[16rem] lg:min-w-[20rem] max-w-[90vw] max-h-[70vh] overflow-auto bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50 origin-top animate-in fade-in"
                      style={{ position: 'fixed', top: panelPos.top, right: panelPos.right }}
                    >
                      <div className="py-1">
                        <Link href="/calendar" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                          🗓️ Calendar
                        </Link>
                        {isAdminLike && (
                          <Link href="/deliveries/set" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                            ✅ Set Deliveries
                          </Link>
                        )}
                        <Link href="/deliveries/planning" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                          🗓️ Deliveries Planning
                        </Link>
                        <Link href="/staff-deliveries" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                          👷 Staff View (Today)
                        </Link>
                        <Link href={`/daily-deliveries?date=${new Date().toISOString().slice(0, 10)}`} onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                          📅 Daily Deliveries
                        </Link>
                      </div>
                    </div>
                  </Portal>
                )}
              </div>
              <span className="text-gray-300">·</span>

              {/* Stores (show for non-admins; admins have it under Admin menu) */}
              {!isAdminLike && (
                <>
                  <Link href="/admin/stores" className="shrink-0 snap-start font-medium px-2 py-1 rounded-md hover:bg-gray-100 hover:text-gray-900 transition-colors">Stores</Link>
                  <span className="text-gray-300">·</span>
                </>
              )}

              {/* Admin Menu (admin/system_admin) */}
              {isAdminLike && (
                <>
                  <div
                    className="relative dropdown-menu"
                    onMouseEnter={() => scheduleOpen('admin')}
                    onMouseLeave={scheduleClose}
                  >
                    <button
                      ref={adminBtnRef}
                      onClick={() => setOpenMenu((m) => (m === 'admin' ? null : 'admin'))}
                      aria-expanded={openMenu === 'admin'}
                      className={`shrink-0 snap-start group font-medium flex items-center gap-1 px-2 py-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${openMenu === 'admin' ? 'text-gray-900 bg-gray-100' : 'hover:bg-gray-100 hover:text-gray-900'}`}
                    >
                      Admin
                      <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${openMenu === 'admin' ? 'rotate-180' : 'group-hover:rotate-180'}`} />
                    </button>
                    {openMenu === 'admin' && panelPos && (
                      <Portal>
                        <div
                          data-dropdown-portal="true"
                          onMouseEnter={() => scheduleOpen('admin')}
                          onMouseLeave={scheduleClose}
                          className="min-w-[16rem] lg:min-w-[20rem] max-w-[90vw] max-h-[70vh] overflow-auto bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50 origin-top animate-in fade-in"
                          style={{ position: 'fixed', top: panelPos.top, right: panelPos.right }}
                        >
                          <div className="py-1 grid grid-cols-1 sm:grid-cols-2 gap-1">
                            <Link href="/admin" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                              🏠 Admin Dashboard
                            </Link>
                            <Link href="/admin/users" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                              👥 Manage Users
                            </Link>
                            <Link href="/admin/stores" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                              🏪 Store Management
                            </Link>
                            <Link href="/admin/roles" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                              🛡️ Manage Roles
                            </Link>
                            <Link href="/flavors" onClick={() => setOpenMenu(null)} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors">
                              🍦 Flavors
                            </Link>
                          </div>
                        </div>
                      </Portal>
                    )}
                  </div>
                  <span className="text-gray-300">·</span>
                </>
              )}

              <UserMenu />
            </>
          ) : isLoading ? (
            <span className="text-gray-400">Loading…</span>
          ) : (
            <Link href="/login" className="hover:text-gray-900 transition-colors font-medium text-blue-600">Login</Link>
          )}
          {/* Right fade */}
          {showRightFade && (
            <div className="pointer-events-none absolute right-0 top-0 h-full w-6 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />)
          }
        </nav>
      </div>

      {/* Mobile overlay (click to close) */}
      {isAuthenticated && (
        <div
          className={`fixed inset-0 bg-black/30 md:hidden transition-opacity duration-200 ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
          style={{ zIndex: 20 }}
        />
      )}

      {/* Mobile menu panel - animated */}
      {isAuthenticated && user && (
        <div
          id="mobile-menu"
          aria-hidden={!mobileOpen}
          className={`md:hidden absolute left-0 right-0 top-full border-b border-gray-200 bg-white/95 backdrop-blur transform transition-all duration-200 ease-out ${mobileOpen ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 -translate-y-2 pointer-events-none'}`}
          style={{ zIndex: 30 }}
        >
          <div className="px-6 py-4 space-y-6 text-gray-700">
            <div className="flex items-center justify-between">
              <span className="text-gray-900 font-medium">Hello, {user.firstName}</span>
              <UserMenu />
            </div>

            <div className="space-y-1">
              <Link href="/" className="block px-2 py-2 rounded hover:bg-gray-100 font-medium">Store Stocktake</Link>
            </div>

            <div>
              <div className="px-2 text-xs uppercase tracking-wide text-gray-400 mb-1">Inventory</div>
              <div className="space-y-1">
                {hasPermission?.('stocktakes:read') && (
                  <Link href="/inventory" className="block px-2 py-2 rounded hover:bg-gray-100">📊 Main Inventory</Link>
                )}
                {hasPermission?.('stocktakes:create') && (
                  <Link href="/factory/intake" className="block px-2 py-2 rounded hover:bg-gray-100">🏭 Incoming Stock (Factory)</Link>
                )}
                {/* Master Snapshot link removed (tucked under Factory Advanced) */}
                {hasPermission?.('stocktakes:create') && (
                  <Link href="/store/adjust" className="block px-2 py-2 rounded hover:bg-gray-100">➕ Adjust Stock</Link>
                )}
                {hasPermission?.('stocktakes:read') && (
                  <Link href="/stocktakes" className="block px-2 py-2 rounded hover:bg-gray-100">📝 Stocktakes</Link>
                )}
                <Link href="/orders" className="block px-2 py-2 rounded hover:bg-gray-100">📦 Orders & Supplies</Link>
              </div>
            </div>

            <div>
              <div className="px-2 text-xs uppercase tracking-wide text-gray-400 mb-1">Production</div>
              <div className="space-y-1">
                <Link href="/factory" className="block px-2 py-2 rounded hover:bg-gray-100">🏭 Factory Dashboard</Link>
                <Link href="/factory/production" className="block px-2 py-2 rounded hover:bg-gray-100">🧰 Today’s Production</Link>
                <Link href="/factory/production-planning" className="block px-2 py-2 rounded hover:bg-gray-100">🛠️ Production Planning</Link>
                {isAdminLike && (
                  <Link href="/admin/production-schedule" className="block px-2 py-2 rounded hover:bg-gray-100">🗓️ Schedule Production</Link>
                )}
                <Link href="/production/analytics" className="block px-2 py-2 rounded hover:bg-gray-100">📈 Production Analytics</Link>
              </div>
            </div>

            <div>
              <div className="px-2 text-xs uppercase tracking-wide text-gray-400 mb-1">Deliveries</div>
              <div className="space-y-1">
                <Link href="/calendar" className="block px-2 py-2 rounded hover:bg-gray-100">🗓️ Calendar</Link>
                {isAdminLike && (
                  <Link href="/deliveries/set" className="block px-2 py-2 rounded hover:bg-gray-100">✅ Set Deliveries</Link>
                )}
                <Link href="/deliveries/planning" className="block px-2 py-2 rounded hover:bg-gray-100">🗓️ Deliveries Planning</Link>
                <Link href="/staff-deliveries" className="block px-2 py-2 rounded hover:bg-gray-100">👷 Staff View (Today)</Link>
                <Link href={`/daily-deliveries?date=${new Date().toISOString().slice(0, 10)}`} className="block px-2 py-2 rounded hover:bg-gray-100">📅 Daily Deliveries</Link>
              </div>
            </div>

            <div>
              <div className="px-2 text-xs uppercase tracking-wide text-gray-400 mb-1">Stores</div>
              <div className="space-y-1">
                <Link href="/admin/stores" className="block px-2 py-2 rounded hover:bg-gray-100">Stores</Link>
              </div>
            </div>

            {isAdminLike && (
              <div>
                <div className="px-2 text-xs uppercase tracking-wide text-gray-400 mb-1">Admin</div>
                <div className="space-y-1">
                  <Link href="/admin" className="block px-2 py-2 rounded hover:bg-gray-100">🏠 Admin Dashboard</Link>
                  <Link href="/admin/users" className="block px-2 py-2 rounded hover:bg-gray-100">👥 Manage Users</Link>
                  <Link href="/admin/stores" className="block px-2 py-2 rounded hover:bg-gray-100">🏪 Store Management</Link>
                  <Link href="/admin/roles" className="block px-2 py-2 rounded hover:bg-gray-100">🛡️ Manage Roles</Link>
                  <Link href="/flavors" className="block px-2 py-2 rounded hover:bg-gray-100">🍦 Flavors</Link>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
