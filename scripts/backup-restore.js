#!/usr/bin/env node

/**
 * Stocktake Database Backup & Restore System
 * Provides comprehensive backup, restore, and data validation functionality
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { execSync } = require('child_process');

const prisma = new PrismaClient();

class BackupRestoreManager {
  constructor() {
    this.backupDir = path.join(process.cwd(), 'backups');
    this.ensureBackupDirectory();
  }

  ensureBackupDirectory() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
      console.log(`✅ Created backup directory: ${this.backupDir}`);
    }
  }

  async createBackup(backupName = null) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = backupName || `backup-${timestamp}.json`;
    const filepath = path.join(this.backupDir, filename);

    console.log(`🚀 Starting backup: ${filename}`);

    try {
      // Export all data in dependency order
      const data = {
        metadata: {
          timestamp: new Date().toISOString(),
          version: '1.0.0',
          database: 'stocktake',
          tables: []
        },
        data: {}
      };

      // Export tables in dependency order (parents first)
      const tables = [
        'category',
        'item',
        'store',
        'storeInventory',
        'customer',
        'supplier',
        'user',
        'role',
        'permission',
        'rolePermission',
        'userRole',
        'session',
        'recipe',
        'recipeIngredient',
        'stocktake',
        'stocktakeItem',
        'deliveryPlan',
        'deliveryPlanCustomer',
        'deliveryItem',
        'order',
        'orderItem',
        'production',
        'productionIngredient'
      ];

      for (const table of tables) {
        console.log(`📊 Exporting ${table}...`);
        const records = await prisma[table].findMany({
          include: this.getIncludeForTable(table)
        });

        data.data[table] = records;
        data.metadata.tables.push({
          name: table,
          count: records.length
        });
      }

      // Write backup file
      fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
      console.log(`✅ Backup created: ${filepath}`);
      console.log(`📊 Total records: ${data.metadata.tables.reduce((sum, t) => sum + t.count, 0)}`);

      // Create compressed version
      const compressedPath = filepath.replace('.json', '.json.gz');
      try {
        execSync(`gzip -c "${filepath}" > "${compressedPath}"`);
        console.log(`📦 Compressed backup: ${compressedPath}`);
      } catch (error) {
        console.log(`⚠️  Compression failed, keeping uncompressed file`);
      }

      return { success: true, filepath, compressedPath };

    } catch (error) {
      console.error('❌ Backup failed:', error);
      return { success: false, error: error.message };
    }
  }

  getIncludeForTable(table) {
    const includes = {
      item: { category: true },
      store: { stocktakes: true, deliveryPlans: true, inventory: true },
      storeInventory: { store: true, item: true },
      customer: { deliveryPlans: true },
      supplier: { orders: true },
      user: { roles: true, sessions: true },
      role: { users: true, permissions: true },
      permission: { roles: true },
      recipe: { ingredients: true, productions: true },
      recipeIngredient: { recipe: true, item: true },
      stocktake: { store: true, items: { include: { item: true } } },
      stocktakeItem: { stocktake: true, item: true },
      deliveryPlan: {
        store: true,
        customers: { include: { customer: true } },
        items: { include: { item: true } }
      },
      deliveryPlanCustomer: { plan: true, customer: true },
      deliveryItem: { plan: true, item: true },
      order: {
        supplier: true,
        items: { include: { item: true } }
      },
      orderItem: { order: true, item: true },
      production: {
        recipe: true,
        ingredients: { include: { item: true } }
      },
      productionIngredient: { production: true, item: true },
      userRole: { user: true, role: true },
      rolePermission: { role: true, permission: true },
      session: { user: true }
    };
    return includes[table] || {};
  }

  async restoreBackup(backupPath, options = {}) {
    const {
      dryRun = false,
      skipValidation = false,
      clearExisting = false
    } = options;

    console.log(`🔄 Starting restore from: ${backupPath}`);
    if (dryRun) console.log(`🔍 DRY RUN MODE - No changes will be made`);

    try {
      // Read and parse backup file
      let backupData;
      if (backupPath.endsWith('.gz')) {
        const decompressed = execSync(`gzip -dc "${backupPath}"`).toString();
        backupData = JSON.parse(decompressed);
      } else {
        backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      }

      console.log(`📊 Backup contains ${backupData.metadata.tables.reduce((sum, t) => sum + t.count, 0)} records`);

      // Validate backup structure
      if (!skipValidation) {
        const validation = this.validateBackup(backupData);
        if (!validation.valid) {
          throw new Error(`Backup validation failed: ${validation.errors.join(', ')}`);
        }
      }

      if (dryRun) {
        console.log(`✅ Dry run completed successfully`);
        return { success: true, dryRun: true };
      }

      // Clear existing data if requested
      if (clearExisting) {
        await this.clearAllData();
      }

      // Import tables in reverse dependency order
      const importOrder = [
        'productionIngredient',
        'production',
        'orderItem',
        'order',
        'deliveryItem',
        'deliveryPlanCustomer',
        'deliveryPlan',
        'stocktakeItem',
        'stocktake',
        'recipeIngredient',
        'recipe',
        'session',
        'userRole',
        'rolePermission',
        'permission',
        'role',
        'user',
        'supplier',
        'customer',
        'storeInventory',
        'store',
        'item',
        'category'
      ];

      for (const table of importOrder) {
        if (backupData.data[table]) {
          console.log(`📥 Importing ${table} (${backupData.data[table].length} records)...`);
          await this.importTable(table, backupData.data[table]);
        }
      }

      console.log(`✅ Restore completed successfully`);
      return { success: true, restored: backupData.metadata };

    } catch (error) {
      console.error('❌ Restore failed:', error);
      return { success: false, error: error.message };
    }
  }

  async clearAllData() {
    console.log(`🗑️  Clearing existing data...`);

    const tables = [
      'storeInventory',
      'productionIngredient',
      'production',
      'orderItem',
      'order',
      'deliveryItem',
      'deliveryPlanCustomer',
      'deliveryPlan',
      'stocktakeItem',
      'stocktake',
      'recipeIngredient',
      'recipe',
      'session',
      'userRole',
      'rolePermission',
      'permission',
      'role',
      'user',
      'supplier',
      'customer',
      'store',
      'item',
      'category'
    ];

    for (const table of tables) {
      try {
        await prisma[table].deleteMany();
        console.log(`🗑️  Cleared ${table}`);
      } catch (error) {
        console.log(`⚠️  Failed to clear ${table}:`, error.message);
      }
    }
  }

  async importTable(tableName, records) {
    const model = prisma[tableName];

    // Process records in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);

      // Clean records for import (remove relations, keep IDs)
      const cleanBatch = batch.map(record => {
        const clean = { ...record };

        // Remove relational data, keep only foreign keys
        Object.keys(clean).forEach(key => {
          if (typeof clean[key] === 'object' && clean[key] !== null && !Array.isArray(clean[key])) {
            delete clean[key];
          }
        });

        return clean;
      });

      await model.createMany({ data: cleanBatch, skipDuplicates: true });
    }
  }

  validateBackup(backupData) {
    const errors = [];

    if (!backupData.metadata) {
      errors.push('Missing metadata');
    }

    if (!backupData.data) {
      errors.push('Missing data section');
    }

    // Check required tables
    const requiredTables = ['User', 'Store', 'Item', 'Category'];
    for (const table of requiredTables) {
      if (!backupData.data[table] || backupData.data[table].length === 0) {
        errors.push(`Missing or empty required table: ${table}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  async listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir)
        .filter(file => file.endsWith('.json') || file.endsWith('.json.gz'))
        .map(file => {
          const filepath = path.join(this.backupDir, file);
          const stats = fs.statSync(filepath);
          return {
            name: file,
            path: filepath,
            size: stats.size,
            created: stats.birthtime,
            compressed: file.endsWith('.gz')
          };
        })
        .sort((a, b) => b.created - a.created);

      console.log(`📁 Available backups in ${this.backupDir}:`);
      files.forEach(backup => {
        console.log(`  ${backup.name} (${(backup.size / 1024 / 1024).toFixed(2)} MB) - ${backup.created.toISOString()}`);
      });

      return files;
    } catch (error) {
      console.error('❌ Failed to list backups:', error);
      return [];
    }
  }

  async cleanupOldBackups(keepDays = 30) {
    try {
      const files = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - keepDays);

      let deletedCount = 0;
      for (const file of files) {
        if (file.created < cutoffDate) {
          fs.unlinkSync(file.path);
          console.log(`🗑️  Deleted old backup: ${file.name}`);
          deletedCount++;
        }
      }

      console.log(`✅ Cleanup completed. Deleted ${deletedCount} old backups.`);
      return { success: true, deleted: deletedCount };
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      return { success: false, error: error.message };
    }
  }

  async exportToSQL(backupPath, outputPath) {
    try {
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

      let sql = `-- Stocktake Database Export
-- Generated: ${new Date().toISOString()}
-- Source: ${backupPath}

`;

      // Generate INSERT statements for each table
      for (const [tableName, records] of Object.entries(backupData.data)) {
        if (records.length === 0) continue;

        sql += `-- ${tableName} (${records.length} records)\n`;

        for (const record of records) {
          const columns = Object.keys(record).filter(key => !key.includes('At') || key === 'createdAt' || key === 'updatedAt');
          const values = columns.map(col => {
            const value = record[col];
            if (value === null) return 'NULL';
            if (typeof value === 'string') return `'${value.replace(/'/g, "''")}'`;
            if (typeof value === 'boolean') return value ? '1' : '0';
            if (value instanceof Date) return `'${value.toISOString()}'`;
            return value;
          });

          sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }

        sql += '\n';
      }

      fs.writeFileSync(outputPath, sql);
      console.log(`✅ SQL export created: ${outputPath}`);
      return { success: true, path: outputPath };

    } catch (error) {
      console.error('❌ SQL export failed:', error);
      return { success: false, error: error.message };
    }
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const manager = new BackupRestoreManager();

  switch (command) {
    case 'backup':
      const backupName = args[1];
      await manager.createBackup(backupName);
      break;

    case 'restore':
      const backupPath = args[1];
      const options = {
        dryRun: args.includes('--dry-run'),
        skipValidation: args.includes('--skip-validation'),
        clearExisting: args.includes('--clear-existing')
      };

      if (!backupPath) {
        console.error('❌ Please specify backup file path');
        console.log('Usage: node backup-restore.js restore <backup-file> [--dry-run] [--skip-validation] [--clear-existing]');
        process.exit(1);
      }

      await manager.restoreBackup(backupPath, options);
      break;

    case 'list':
      await manager.listBackups();
      break;

    case 'cleanup':
      const keepDays = parseInt(args[1]) || 30;
      await manager.cleanupOldBackups(keepDays);
      break;

    case 'export-sql':
      const sourceBackup = args[1];
      const outputSQL = args[2] || sourceBackup.replace('.json', '.sql');

      if (!sourceBackup) {
        console.error('❌ Please specify backup file path');
        console.log('Usage: node backup-restore.js export-sql <backup-file> [output-sql-file]');
        process.exit(1);
      }

      await manager.exportToSQL(sourceBackup, outputSQL);
      break;

    default:
      console.log(`
🚀 Stocktake Backup & Restore Manager

Usage:
  node backup-restore.js backup [name]                    - Create new backup
  node backup-restore.js restore <file> [options]         - Restore from backup
  node backup-restore.js list                             - List available backups
  node backup-restore.js cleanup [days]                   - Remove old backups (default: 30 days)
  node backup-restore.js export-sql <file> [output]       - Export backup to SQL

Restore Options:
  --dry-run          - Test restore without making changes
  --skip-validation  - Skip backup validation
  --clear-existing   - Clear existing data before restore

Examples:
  node backup-restore.js backup
  node backup-restore.js backup my-backup
  node backup-restore.js restore backups/backup-2024-01-01.json
  node backup-restore.js restore backup.json --dry-run
  node backup-restore.js list
  node backup-restore.js cleanup 7
      `);
      break;
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BackupRestoreManager;
