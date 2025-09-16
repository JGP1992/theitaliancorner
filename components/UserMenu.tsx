'use client';

import { useState } from 'react';
import { User, LogOut } from 'lucide-react';
import { useAuth } from './AuthContext';

export default function UserMenu() {
  const { user, isAuthenticated, logout } = useAuth();
  const [showMenu, setShowMenu] = useState(false);

  if (!isAuthenticated || !user) {
    return (
      <a
        href="/login"
        className="hover:text-gray-900 transition-colors font-medium flex items-center gap-1"
      >
        <User className="h-4 w-4" />
        Login
      </a>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => logout()}
        className="hover:text-gray-900 transition-colors font-medium flex items-center gap-2"
      >
        <LogOut className="h-4 w-4" />
        Logout
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            <div className="px-4 py-2 text-sm text-gray-700 border-b">
              <div className="font-medium">{user.firstName} {user.lastName}</div>
              <div className="text-gray-500">{user.email}</div>
            </div>

            <div className="px-4 py-2">
              <div className="text-xs text-gray-500 mb-1">Roles:</div>
              <div className="flex flex-wrap gap-1">
                {user.roles.map((role) => (
                  <span
                    key={role}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                  >
                    {role}
                  </span>
                ))}
              </div>
            </div>

            <div className="border-t" />
          </div>
        </div>
      )}
    </div>
  );
}
