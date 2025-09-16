import { redirect } from 'next/navigation';
import { prisma } from '@/app/lib/prisma';
import Logo from '@/components/Logo';
import FirstRunForm from '@/components/FirstRunForm';
import React from 'react';
import '../globals.css';

// Ensure this page is always rendered dynamically at runtime (not during static build)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

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
