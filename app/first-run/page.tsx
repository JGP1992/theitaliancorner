import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import Logo from '@/components/Logo';
import React from 'react';
import '../globals.css';

export default async function FirstRunPage() {
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <Logo />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">First-time setup</h1>
          <p className="text-gray-600">Create the first admin user for your system</p>
        </div>
        <FirstRunForm />
        <p className="text-center text-sm text-gray-500">2025 © Webhoot</p>
      </div>
    </div>
  );
}

function FirstRunForm() {
  // Client component wrapper
  return (
    <form
      className="bg-white rounded-xl shadow-lg p-8 space-y-4"
      // Prevent default submit; handled in onSubmit below via client JS
      onSubmit={(e) => e.preventDefault()}
    >
      {/* Email */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
        <input name="email" type="email" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="admin@example.com" />
      </div>
      {/* First name / Last name */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">First name</label>
          <input name="firstName" type="text" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Admin" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Last name</label>
          <input name="lastName" type="text" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="User" />
        </div>
      </div>
      {/* Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
        <input name="password" type="password" required className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Strong password" />
      </div>

      <div id="error" className="hidden rounded-lg bg-red-50 p-3 border border-red-200 text-sm text-red-700"></div>
      <div id="success" className="hidden rounded-lg bg-green-50 p-3 border border-green-200 text-sm text-green-700"></div>

      <button
        type="button"
        onClick={async (e) => {
          const form = (e.currentTarget as HTMLButtonElement).form as HTMLFormElement;
          const get = (name: string) => (form.elements.namedItem(name) as HTMLInputElement | null)?.value.trim() || '';
          const email = get('email');
          const password = get('password');
          const firstName = get('firstName');
          const lastName = get('lastName');
          const err = document.getElementById('error');
          const ok = document.getElementById('success');
          if (err) { err.classList.add('hidden'); err.textContent = ''; }
          if (ok) { ok.classList.add('hidden'); ok.textContent = ''; }

          try {
            // Create first user (register route allows first user without token)
            const res = await fetch('/api/auth/register', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ email, password, firstName, lastName, roleIds: [] })
            });
            if (!res.ok) {
              const j = await res.json().catch(() => ({}));
              throw new Error(j?.error || `Registration failed (${res.status})`);
            }

            // Log in to set auth cookie
            const loginRes = await fetch('/api/auth/login', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ email, password, rememberMe: true })
            });
            if (!loginRes.ok) {
              const j = await loginRes.json().catch(() => ({}));
              throw new Error(j?.error || `Login failed (${loginRes.status})`);
            }

            if (ok) {
              ok.textContent = 'Admin created. Redirecting…';
              ok.classList.remove('hidden');
            }
            // Redirect home
            window.location.href = '/';
          } catch (e: any) {
            if (err) {
              err.textContent = e?.message || 'Something went wrong';
              err.classList.remove('hidden');
            }
          }
        }}
        className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
      >
        Create admin
      </button>
    </form>
  );
}
