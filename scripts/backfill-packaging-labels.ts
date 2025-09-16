/*
 Backfill ProductionTask notes with formatted packaging labels including size.
 - Finds tasks whose notes include "Packaging: <name>" without a size suffix.
 - Looks up PackagingOption by name, and if sizeValue/sizeUnit exist, updates the notes to "Packaging: <name> (<sizeValue> <sizeUnit>)".
 - Idempotent: if notes already have a size in parentheses after the name, leaves unchanged.
*/

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function hasSizeSuffix(notes: string): boolean {
  // Matches: Packaging: Something (2.5 kg)
  return /Packaging:\s*[^|\n\r]+\([^\)]+\)/i.test(notes);
}

function extractPackagingName(notes: string): string | null {
  const m = notes.match(/Packaging:\s*([^|\n\r\(]+)\s*(?:\(|\||$)/i);
  return m ? m[1].trim() : null;
}

function formatUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = unit.toUpperCase();
  if (u === 'ML' || u === 'L' || u === 'KG') return u.toLowerCase();
  return unit; // fallback
}

async function main() {
  const batchSize = 200;
  let skip = 0;
  let updated = 0;
  let scanned = 0;

  for (;;) {
    const tasks = await prisma.productionTask.findMany({
      where: {
        notes: { contains: 'Packaging:', mode: 'insensitive' },
      },
      select: { id: true, notes: true },
      take: batchSize,
      skip,
      orderBy: { id: 'asc' },
    });
    if (tasks.length === 0) break;

    for (const t of tasks) {
      scanned++;
      const notes = t.notes || '';
      if (!notes) continue;
      if (hasSizeSuffix(notes)) continue; // already has size
      const name = extractPackagingName(notes);
      if (!name) continue;

      // Find PackagingOption by name case-insensitive
      const opt = await prisma.packagingOption.findFirst({
        where: { name: { equals: name, mode: 'insensitive' } },
        select: { name: true, sizeValue: true, sizeUnit: true },
      });
      if (!opt || opt.sizeValue == null || !opt.sizeUnit) continue;

      const sizeStr = `${opt.sizeValue} ${formatUnit(opt.sizeUnit)}`;
      // Replace the first occurrence of Packaging: <name> with Packaging: <name> (<size>)
      const newNotes = notes.replace(/Packaging:\s*([^|\n\r\(]+)(\s*\||$)/i, (_m, nm: string, tail: string) => {
        const trimmed = nm.trim();
        // If the name already includes size string, skip
        if (trimmed.toLowerCase().includes(sizeStr.toLowerCase())) return `Packaging: ${trimmed}${tail}`;
        return `Packaging: ${trimmed} (${sizeStr})${tail}`;
      });

      if (newNotes !== notes) {
        await prisma.productionTask.update({ where: { id: t.id }, data: { notes: newNotes } });
        updated++;
      }
    }

    skip += tasks.length;
    if (tasks.length < batchSize) break;
  }

  console.log(JSON.stringify({ scanned, updated }));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
