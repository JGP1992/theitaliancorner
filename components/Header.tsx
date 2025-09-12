'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import UserMenu from './UserMenu';
import { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { useAuth } from './AuthContext';

export default function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuth();
  const [showInventoryMenu, setShowInventoryMenu] = useState(false);
  const [showAdminMenu, setShowAdminMenu] = useState(false);

  // Hide header on login page
  if (pathname === '/login') {
    return null;
  }

  // Check if user has admin or manager role
  const isAdminOrManager = user?.roles?.includes('admin') || user?.roles?.includes('manager') || false;

  return (
    <header className="sticky top-0 z-30 backdrop-blur bg-white/80 border-b border-gray-200">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3">
          <img
            src="/Untitled.png"
            alt="TIC Logo"
            className="h-16 w-auto"
          />
        </Link>
        <nav className="flex items-center space-x-6 text-sm text-gray-600">
          {isAuthenticated && user ? (
            <span className="text-gray-900 font-medium">
              Hello, {user.firstName}
            </span>
          ) : null}
          <span className="text-gray-300">·</span>

          {/* Dashboard */}
          <Link href="/" className="hover:text-gray-900 transition-colors font-medium">Dashboard</Link>
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

          {/* Production */}
          <Link href="/factory" className="hover:text-gray-900 transition-colors font-medium">Production</Link>
          <span className="text-gray-300">·</span>

          {/* Deliveries */}
          <Link href="/staff-deliveries" className="hover:text-gray-900 transition-colors font-medium">Deliveries</Link>
          <span className="text-gray-300">·</span>

          {/* Stores */}
          <Link href="/stores" className="hover:text-gray-900 transition-colors font-medium">Stores</Link>
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
        </nav>
      </div>
    </header>
  );
}
