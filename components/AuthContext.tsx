'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: string[];
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (user: User) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  hasPermission: (permission: string) => boolean;
  hasRole: (role: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  // Start in loading state to avoid flicker/loops before first auth check completes
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const isAuthenticated = !!user;

  const checkAuth = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/status', { credentials: 'include', cache: 'no-store' as RequestCache });
      if (!response.ok) {
        setUser(null);
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('userLogout'));
        return;
      }
      const data = await response.json();

      if (data?.authenticated && data?.user) {
        setUser(data.user);
        // Update localStorage for other components
        localStorage.setItem('user', JSON.stringify(data.user));
        window.dispatchEvent(new CustomEvent('userLogin'));
      } else {
        setUser(null);
        localStorage.removeItem('user');
        window.dispatchEvent(new CustomEvent('userLogout'));
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setUser(null);
      localStorage.removeItem('user');
      window.dispatchEvent(new CustomEvent('userLogout'));
    } finally {
      setIsLoading(false);
    }
  };

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    window.dispatchEvent(new CustomEvent('userLogin'));
  };

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    setUser(null);
    localStorage.removeItem('user');
    window.dispatchEvent(new CustomEvent('userLogout'));
    // Force a hard navigation to avoid stale client chunks after a deploy
    if (typeof window !== 'undefined' && 'location' in window) {
      window.location.assign('/login');
      return;
    }
    router.push('/login');
  };

  const hasPermission = (permission: string): boolean => {
    return user?.permissions?.includes(permission) || false;
  };

  const hasRole = (role: string): boolean => {
    return user?.roles?.includes(role) || false;
  };

  useEffect(() => {
    // Bootstrap from localStorage to avoid header/nav flicker
    try {
      const cached = localStorage.getItem('user');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.id) {
          setUser(parsed);
        }
      }
    } catch {}
    checkAuth();
  }, []);

  // Check auth status periodically to keep client and server in sync
  useEffect(() => {
    const interval = setInterval(() => {
      if (isAuthenticated) {
        checkAuth();
      }
    }, 10 * 60 * 1000); // Check every 10 minutes instead of 5

    return () => clearInterval(interval);
  }, [isAuthenticated]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated,
    login,
    logout,
    checkAuth,
    hasPermission,
    hasRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
