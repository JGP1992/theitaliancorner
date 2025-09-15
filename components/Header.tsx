'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import UserMenu from './UserMenu';
import { useState, useEffect } from 'react';
import { ChevronDown, Menu as MenuIcon, X as XIcon } from 'lucide-react';
import { useAuth } from './AuthContext';

export default function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();
  const [showInventoryMenu, setShowInventoryMenu] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);
  const [showDeliveriesMenu, setShowDeliveriesMenu] = useState(false);
  const [showProductionMenu, setShowProductionMenu] = useState(false);
  // Mobile menu state
  const [mobileOpen, setMobileOpen] = useState(false);
  // Prevent SSR/hydration mismatch: don't render auth-dependent nav until mounted
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Hide header on login page
  if (pathname === '/login') {
    return null;
  }

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Check if user has admin or manager role
  const isAdminOrManager = user?.roles?.includes('admin') || user?.roles?.includes('manager') || false;

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
        <nav className="hidden md:flex items-center space-x-6 text-sm text-gray-600">
          {!mounted ? (
            <span className="text-gray-400">Loading…</span>
          ) : isAuthenticated && user ? (
            <>
              <span className="text-gray-900 font-medium">
                Hello, {user.firstName}
              </span>
              <span className="text-gray-300">·</span>

              {/* Store Stocktake */}
              <Link href="/" className="hover:text-gray-900 transition-colors font-medium">Store Stocktake</Link>
              <span className="text-gray-300">·</span>

              {/* Inventory Dropdown */}
              <div className="relative dropdown-menu">
                <button
                  onClick={() => setShowInventoryMenu(!showInventoryMenu)}
                  className="hover:text-gray-900 transition-colors font-medium flex items-center gap-1"
                >
                  Inventory
                  <ChevronDown className="h-4 w-4" />
                </button>
                {showInventoryMenu && (
                  <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <Link href="/store/adjust" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        ➕ Adjust Stock
                      </Link>
                      <Link href="/inventory" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        📊 Inventory Dashboard
                      </Link>
                      <Link href="/stocktakes" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        📝 Stocktakes
                      </Link>
                      <Link href="/orders" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        📦 Orders & Supplies
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-gray-300">·</span>

              {/* Production Dropdown */}
              <div className="relative dropdown-menu">
                <button
                  onClick={() => setShowProductionMenu(!showProductionMenu)}
                  className="hover:text-gray-900 transition-colors font-medium flex items-center gap-1"
                >
                  Production
                  <ChevronDown className="h-4 w-4" />
                </button>
                {showProductionMenu && (
                  <div className="absolute left-0 mt-2 w-56 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <Link href="/factory" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        🏭 Factory Dashboard
                      </Link>
                      <Link href="/factory/production-planning" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        🛠️ Production Planning
                      </Link>
                      <Link href="/production/analytics" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        📈 Production Analytics
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-gray-300">·</span>

              {/* Deliveries Dropdown */}
              <div className="relative dropdown-menu">
                <button
                  onClick={() => setShowDeliveriesMenu(!showDeliveriesMenu)}
                  className="hover:text-gray-900 transition-colors font-medium flex items-center gap-1"
                >
                  Deliveries
                  <ChevronDown className="h-4 w-4" />
                </button>
                {showDeliveriesMenu && (
                  <div className="absolute left-0 mt-2 w-64 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      <Link href="/calendar" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        🗓️ Calendar
                      </Link>
                      {isAdminOrManager && (
                        <Link href="/deliveries/set" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                          ✅ Set Deliveries
                        </Link>
                      )}
                      <Link href="/deliveries/planning" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        🗓️ Deliveries Planning
                      </Link>
                      <Link href="/staff-deliveries" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        👷 Staff View (Today)
                      </Link>
                      <Link href={`/daily-deliveries?date=${new Date().toISOString().slice(0, 10)}`} className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                        📅 Daily Deliveries
                      </Link>
                    </div>
                  </div>
                )}
              </div>
              <span className="text-gray-300">·</span>

              {/* Stores */}
              <Link href="/admin/stores" className="hover:text-gray-900 transition-colors font-medium">Stores</Link>
              <span className="text-gray-300">·</span>

              {/* Admin Menu for admin/manager */}
              {isAdminOrManager && (
                <>
                  <div className="relative dropdown-menu">
                    <button
                      onClick={() => setShowAdminMenu(!showAdminMenu)}
                      className="hover:text-gray-900 transition-colors font-medium flex items-center gap-1"
                    >
                      Admin
                      <ChevronDown className="h-4 w-4" />
                    </button>
                    {showAdminMenu && (
                      <div className="absolute left-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                        <div className="py-1">
                          <Link href="/admin" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            🏠 Admin Dashboard
                          </Link>
                          <Link href="/admin/users" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            👥 Manage Users
                          </Link>
                          <Link href="/admin/stores" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            🏪 Store Management
                          </Link>
                          <Link href="/admin/roles" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            🛡️ Manage Roles
                          </Link>
                          <Link href="/flavors" className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                            🍦 Flavors
                          </Link>
                        </div>
                      </div>
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
                <Link href="/store/adjust" className="block px-2 py-2 rounded hover:bg-gray-100">➕ Adjust Stock</Link>
                <Link href="/inventory" className="block px-2 py-2 rounded hover:bg-gray-100">📊 Inventory Dashboard</Link>
                <Link href="/stocktakes" className="block px-2 py-2 rounded hover:bg-gray-100">📝 Stocktakes</Link>
                <Link href="/orders" className="block px-2 py-2 rounded hover:bg-gray-100">📦 Orders & Supplies</Link>
              </div>
            </div>

            <div>
              <div className="px-2 text-xs uppercase tracking-wide text-gray-400 mb-1">Production</div>
              <div className="space-y-1">
                <Link href="/factory" className="block px-2 py-2 rounded hover:bg-gray-100">🏭 Factory Dashboard</Link>
                <Link href="/factory/production-planning" className="block px-2 py-2 rounded hover:bg-gray-100">🛠️ Production Planning</Link>
                <Link href="/production/analytics" className="block px-2 py-2 rounded hover:bg-gray-100">📈 Production Analytics</Link>
              </div>
            </div>

            <div>
              <div className="px-2 text-xs uppercase tracking-wide text-gray-400 mb-1">Deliveries</div>
              <div className="space-y-1">
                <Link href="/calendar" className="block px-2 py-2 rounded hover:bg-gray-100">🗓️ Calendar</Link>
                {isAdminOrManager && (
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

            {isAdminOrManager && (
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
