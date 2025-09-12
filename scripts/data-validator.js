#!/usr/bin/env node

/**
 * Data Integrity Validator
 * Validates backup data consistency and database integrity
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

class DataIntegrityValidator {
  constructor() {
    this.issues = [];
    this.warnings = [];
  }

  logIssue(message, table = null, recordId = null) {
    const issue = { message, table, recordId, timestamp: new Date().toISOString() };
    this.issues.push(issue);
    console.log(`❌ ${message}`);
  }

  logWarning(message, table = null, recordId = null) {
    const warning = { message, table, recordId, timestamp: new Date().toISOString() };
    this.warnings.push(warning);
    console.log(`⚠️  ${message}`);
  }

  async validateDatabaseIntegrity() {
    console.log(`🔍 Validating database integrity...`);

    try {
      // Check foreign key constraints
      await this.validateForeignKeys();

      // Check data consistency
      await this.validateDataConsistency();

      // Check for orphaned records
      await this.validateOrphanedRecords();

      // Check for duplicate records
      await this.validateDuplicates();

      // Validate business rules
      await this.validateBusinessRules();

      const summary = {
        issues: this.issues.length,
        warnings: this.warnings.length,
        status: this.issues.length === 0 ? 'healthy' : 'critical'
      };

      console.log(`\n📊 Integrity Check Summary:`);
      console.log(`   Issues: ${summary.issues}`);
      console.log(`   Warnings: ${summary.warnings}`);
      console.log(`   Status: ${summary.status.toUpperCase()}`);

      return summary;

    } catch (error) {
      console.error('❌ Integrity check failed:', error);
      return { status: 'error', error: error.message };
    }
  }

  async validateForeignKeys() {
    console.log(`🔗 Checking foreign key constraints...`);

    // Since the schema enforces NOT NULL constraints, we don't need to check for null foreign keys
    // Instead, let's check for data consistency and valid references

    // Check that all stocktakes reference existing stores
    const stocktakes = await prisma.stocktake.findMany({
      select: { id: true, storeId: true, notes: true }
    });

    for (const stocktake of stocktakes) {
      const store = await prisma.store.findUnique({
        where: { id: stocktake.storeId },
        select: { id: true, name: true }
      });

      if (!store) {
        this.logIssue(`Stocktake "${stocktake.notes || 'Unnamed'}" references non-existent store ${stocktake.storeId}`, 'stocktake', stocktake.id);
      }
    }

    // Check that all stocktake items reference existing items
    const stocktakeItems = await prisma.stocktakeItem.findMany({
      select: { id: true, itemId: true, stocktakeId: true }
    });

    for (const item of stocktakeItems) {
      const existingItem = await prisma.item.findUnique({
        where: { id: item.itemId },
        select: { id: true, name: true }
      });

      if (!existingItem) {
        this.logIssue(`StocktakeItem references non-existent item ${item.itemId}`, 'stocktakeItem', item.id);
      }
    }
  }

  async validateDataConsistency() {
    console.log(`📊 Checking data consistency...`);

    // Check for negative quantities
    const negativeQuantities = await prisma.stocktakeItem.findMany({
      where: { quantity: { lt: 0 } },
      select: { id: true, quantity: true, stocktakeId: true }
    });
    negativeQuantities.forEach(item => {
      this.logIssue(`StocktakeItem has negative quantity: ${item.quantity}`, 'stocktakeItem', item.id);
    });

    // Check for future dates in stocktake dates
    const futureStocktakes = await prisma.stocktake.findMany({
      where: { date: { gt: new Date() } },
      select: { id: true, notes: true, date: true }
    });
    futureStocktakes.forEach(stocktake => {
      this.logWarning(`Stocktake "${stocktake.notes || 'Unnamed'}" has future date`, 'stocktake', stocktake.id);
    });

    // Check for empty required fields
    const emptyStocktakes = await prisma.stocktake.findMany({
      where: {
        OR: [
          { notes: '' },
          { notes: { equals: null } }
        ]
      },
      select: { id: true, notes: true }
    });
    emptyStocktakes.forEach(stocktake => {
      this.logIssue(`Stocktake has empty notes`, 'stocktake', stocktake.id);
    });
  }

  async validateOrphanedRecords() {
    console.log(`🔍 Checking for orphaned records...`);

    // Since categoryId is required in the schema, all items should have categories
    // Let's check for other potential issues

    // Find users with no roles
    const usersWithoutRoles = await prisma.user.findMany({
      where: {
        roles: {
          none: {}
        }
      },
      select: { id: true, email: true }
    });
    if (usersWithoutRoles.length > 0) {
      this.logWarning(`${usersWithoutRoles.length} users have no roles assigned`);
    }

    // Find roles with no permissions
    const rolesWithoutPermissions = await prisma.role.findMany({
      where: {
        permissions: {
          none: {}
        }
      },
      select: { id: true, name: true }
    });
    if (rolesWithoutPermissions.length > 0) {
      this.logWarning(`${rolesWithoutPermissions.length} roles have no permissions assigned`);
    }
  }

  async validateDuplicates() {
    console.log(`🔍 Checking for duplicates...`);

    // Check for duplicate emails
    const duplicateEmails = await prisma.$queryRaw`
      SELECT email, COUNT(*) as count
      FROM User
      GROUP BY email
      HAVING COUNT(*) > 1
    `;
    if (duplicateEmails.length > 0) {
      duplicateEmails.forEach(duplicate => {
        this.logIssue(`Duplicate email: ${duplicate.email} (${duplicate.count} times)`, 'user');
      });
    }

    // Check for duplicate item names within categories
    const duplicateItems = await prisma.$queryRaw`
      SELECT name, categoryId, COUNT(*) as count
      FROM Item
      WHERE categoryId IS NOT NULL
      GROUP BY name, categoryId
      HAVING COUNT(*) > 1
    `;
    if (duplicateItems.length > 0) {
      duplicateItems.forEach(duplicate => {
        this.logIssue(`Duplicate item name: ${duplicate.name} in category ${duplicate.categoryId} (${duplicate.count} times)`, 'Item');
      });
    }
  }

  async validateBusinessRules() {
    console.log(`📋 Checking business rules...`);

    // Check for orders with future expected dates
    const futureOrders = await prisma.order.findMany({
      where: { expectedDate: { gt: new Date() } },
      select: { id: true, notes: true, expectedDate: true }
    });
    futureOrders.forEach(order => {
      this.logWarning(`Order "${order.notes || 'Unnamed'}" has future expected date`, 'order', order.id);
    });

    // Check for production with future dates
    const futureProduction = await prisma.production.findMany({
      where: { producedAt: { gt: new Date() } },
      select: { id: true, notes: true, producedAt: true }
    });
    futureProduction.forEach(production => {
      this.logWarning(`Production "${production.notes || 'Unnamed'}" has future production date`, 'production', production.id);
    });
  }

  async validateBackupIntegrity(backupPath) {
    console.log(`🔍 Validating backup integrity: ${backupPath}`);

    try {
      const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

      // Check backup structure
      if (!backupData.metadata || !backupData.data) {
        this.logIssue('Backup missing required metadata or data sections');
        return false;
      }

      // Validate table relationships
      const validationResults = await this.validateBackupRelationships(backupData);

      // Check data completeness
      await this.validateBackupCompleteness(backupData);

      const isValid = this.issues.length === 0;
      console.log(`📊 Backup validation: ${isValid ? 'VALID' : 'INVALID'}`);

      return isValid;

    } catch (error) {
      this.logIssue(`Backup validation failed: ${error.message}`);
      return false;
    }
  }

  async validateBackupRelationships(backupData) {
    // Check that referenced records exist
    const stocktakes = backupData.data.stocktake || [];
    for (const stocktake of stocktakes) {
      if (stocktake.storeId) {
        const store = (backupData.data.store || []).find(s => s.id === stocktake.storeId);
        if (!store) {
          this.logIssue(`Stocktake "${stocktake.notes || 'Unnamed'}" references non-existent store ${stocktake.storeId}`, 'stocktake', stocktake.id);
        }
      }
    }

    // Similar checks for other relationships...
  }

  async validateBackupCompleteness(backupData) {
    const requiredTables = ['user', 'store', 'category'];
    const missingTables = requiredTables.filter(table => !backupData.data[table] || backupData.data[table].length === 0);

    if (missingTables.length > 0) {
      this.logIssue(`Backup missing required tables: ${missingTables.join(', ')}`);
    }
  }

  async generateIntegrityReport() {
    const report = {
      timestamp: new Date().toISOString(),
      database: await this.validateDatabaseIntegrity(),
      issues: this.issues,
      warnings: this.warnings,
      recommendations: this.generateRecommendations()
    };

    const reportPath = path.join(process.cwd(), 'backups', `integrity-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log(`📄 Integrity report saved: ${reportPath}`);
    return report;
  }

  generateRecommendations() {
    const recommendations = [];

    if (this.issues.some(i => i.message.includes('foreign key'))) {
      recommendations.push('Run database migration to add missing foreign key constraints');
    }

    if (this.issues.some(i => i.message.includes('duplicate'))) {
      recommendations.push('Implement unique constraints on usernames and item names');
    }

    if (this.issues.some(i => i.message.includes('negative'))) {
      recommendations.push('Add CHECK constraints to prevent negative quantities');
    }

    if (this.warnings.some(w => w.message.includes('no category'))) {
      recommendations.push('Create a default "Uncategorized" category and assign orphaned items');
    }

    return recommendations;
  }
}

// CLI Interface
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  const validator = new DataIntegrityValidator();

  switch (command) {
    case 'check':
      await validator.validateDatabaseIntegrity();
      break;

    case 'backup':
      const backupPath = args[1];
      if (!backupPath) {
        console.error('❌ Please specify backup file path');
        process.exit(1);
      }
      await validator.validateBackupIntegrity(backupPath);
      break;

    case 'report':
      await validator.generateIntegrityReport();
      break;

    default:
      console.log(`
🔍 Data Integrity Validator

Usage:
  node data-validator.js check          - Validate current database
  node data-validator.js backup <file>  - Validate backup file
  node data-validator.js report         - Generate integrity report

Examples:
  node data-validator.js check
  node data-validator.js backup backups/backup-2024-01-01.json
  node data-validator.js report
      `);
      break;
  }

  await prisma.$disconnect();
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = DataIntegrityValidator;
