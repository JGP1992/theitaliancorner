/*
 Reset production-related data to start fresh.
 Entities:
  - ProductionTask (scheduled tasks)
  - Production (batch records) and ProductionIngredient (ingredients)
 Safe by default: dry-run only. Set COMMIT=1 and RESET_CONFIRM=YES to apply changes.
 Optional filters via env:
  - DATE_BEFORE=YYYY-MM-DD (delete only records before this date)
  - DATE_AFTER=YYYY-MM-DD (delete only records on/after this date)
*/

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function parseDate(s?: string | null): Date | undefined {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(d.getTime()) ? undefined : d;
}

async function main() {
  const dryRun = process.env.COMMIT !== '1';
  const confirm = process.env.RESET_CONFIRM === 'YES';
  const before = parseDate(process.env.DATE_BEFORE);
  const after = parseDate(process.env.DATE_AFTER);

  if (!dryRun && !confirm) {
    console.error('Refusing to reset without RESET_CONFIRM=YES');
    process.exit(2);
  }

  // Build where clauses
  const taskWhere: any = {};
  const prodWhere: any = {};

  if (before || after) {
    const dateRange: any = {};
    if (after) dateRange.gte = after;
    if (before) dateRange.lte = before;
    taskWhere.date = dateRange;
    prodWhere.producedAt = dateRange;
  }

  // Count first
  const [taskCount, prodCount] = await Promise.all([
    prisma.productionTask.count({ where: taskWhere }),
    prisma.production.count({ where: prodWhere }),
  ]);

  const summary = { dryRun, taskCount, prodCount, before: before?.toISOString() ?? null, after: after?.toISOString() ?? null };

  if (dryRun) {
    console.log(JSON.stringify({ action: 'DRY_RUN', ...summary }));
    return;
  }

  // Delete in order: ProductionIngredient (via cascade on delete?), then Production, then ProductionTask
  // We assume no cascading is set, so we delete child relations explicitly where needed.

  // Delete ProductionIngredient via deleteMany on join with Production filter
  const productions = await prisma.production.findMany({ where: prodWhere, select: { id: true } });
  const prodIds = productions.map(p => p.id);
  let deletedProdIngr = 0;
  if (prodIds.length > 0) {
    const res = await prisma.productionIngredient.deleteMany({ where: { productionId: { in: prodIds } } });
    deletedProdIngr = res.count;
  }

  const delProd = await prisma.production.deleteMany({ where: prodWhere });
  const delTasks = await prisma.productionTask.deleteMany({ where: taskWhere });

  console.log(JSON.stringify({ action: 'COMMIT', ...summary, deletedProductionIngredients: deletedProdIngr, deletedProductions: delProd.count, deletedTasks: delTasks.count }));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
