export const dynamic = 'force-dynamic';

import '../../globals.css';
import { prisma } from '@/app/lib/prisma';
import { redirect } from 'next/navigation';

export default async function StoreAdjustRedirectPage() {
  // Try to use lastStoreSlug from client; fallback server-side to first store
  const stores = await prisma.store.findMany({ orderBy: { name: 'asc' }, take: 2 });
  if (stores.length === 0) return <div>No stores</div>;
  const target = stores[0];
  redirect(`/store/${target.slug}/adjust`);
}
