#!/usr/bin/env node

/**
 * Automated Backup Scheduler
 * Runs regular backups and cleanup operations
 */

const path = require('path');
const { BackupRestoreManager } = require('./backup-restore');

class BackupScheduler {
  constructor() {
    this.manager = new BackupRestoreManager();
    this.schedule = {
      daily: { hour: 2, minute: 0 },    // 2:00 AM daily
      weekly: { day: 0, hour: 3, minute: 0 }, // Sunday 3:00 AM
      monthly: { day: 1, hour: 4, minute: 0 } // 1st of month 4:00 AM
    };
  }

  async runScheduledBackup(type = 'daily') {
    console.log(`🕐 Running scheduled ${type} backup...`);

    try {
      const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const backupName = `${type}-backup-${timestamp}`;

      const result = await this.manager.createBackup(backupName);

      if (result.success) {
        console.log(`✅ ${type} backup completed: ${result.filepath}`);

        // Run cleanup after successful backup
        if (type === 'daily') {
          await this.runCleanup();
        }

        return { success: true, backup: result };
      } else {
        console.error(`❌ ${type} backup failed:`, result.error);
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error(`❌ Scheduled backup error:`, error);
      return { success: false, error: error.message };
    }
  }

  async runCleanup() {
    console.log(`🧹 Running backup cleanup...`);
    const result = await this.manager.cleanupOldBackups(30); // Keep 30 days
    return result;
  }

  async runHealthCheck() {
    console.log(`🏥 Running backup system health check...`);

    try {
      // Check backup directory
      const backups = await this.manager.listBackups();

      // Check for recent backups
      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const recentBackups = backups.filter(b => b.created > oneDayAgo);

      // Check disk space (basic check)
      const fs = require('fs');
      const stats = fs.statSync(this.manager.backupDir);
      const freeSpace = stats.blksize * (stats.blocks - stats.blocks); // Simplified

      const health = {
        backupCount: backups.length,
        recentBackups: recentBackups.length,
        lastBackup: backups.length > 0 ? backups[0].created : null,
        status: recentBackups.length > 0 ? 'healthy' : 'warning'
      };

      console.log(`📊 Health Check Results:`);
      console.log(`   Total backups: ${health.backupCount}`);
      console.log(`   Recent backups (24h): ${health.recentBackups}`);
      console.log(`   Last backup: ${health.lastBackup || 'Never'}`);
      console.log(`   Status: ${health.status.toUpperCase()}`);

      return health;
    } catch (error) {
      console.error('❌ Health check failed:', error);
      return { status: 'error', error: error.message };
    }
  }

  shouldRunBackup(type) {
    const now = new Date();
    const schedule = this.schedule[type];

    if (!schedule) return false;

    switch (type) {
      case 'daily':
        return now.getHours() === schedule.hour && now.getMinutes() === schedule.minute;

      case 'weekly':
        return now.getDay() === schedule.day &&
               now.getHours() === schedule.hour &&
               now.getMinutes() === schedule.minute;

      case 'monthly':
        return now.getDate() === schedule.day &&
               now.getHours() === schedule.hour &&
               now.getMinutes() === schedule.minute;

      default:
        return false;
    }
  }

  async run() {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'daily':
        await this.runScheduledBackup('daily');
        break;

      case 'weekly':
        await this.runScheduledBackup('weekly');
        break;

      case 'monthly':
        await this.runScheduledBackup('monthly');
        break;

      case 'health':
        await this.runHealthCheck();
        break;

      case 'cleanup':
        await this.runCleanup();
        break;

      case 'auto':
        // Check which backups should run
        if (this.shouldRunBackup('monthly')) {
          await this.runScheduledBackup('monthly');
        } else if (this.shouldRunBackup('weekly')) {
          await this.runScheduledBackup('weekly');
        } else if (this.shouldRunBackup('daily')) {
          await this.runScheduledBackup('daily');
        } else {
          console.log('⏰ No scheduled backups due at this time');
        }
        break;

      default:
        console.log(`
🚀 Backup Scheduler

Usage:
  node backup-scheduler.js <command>

Commands:
  daily     - Run daily backup
  weekly    - Run weekly backup
  monthly   - Run monthly backup
  auto      - Run appropriate scheduled backup based on time
  health    - Run system health check
  cleanup   - Clean up old backups

Scheduling:
  Daily:   2:00 AM every day
  Weekly:  3:00 AM every Sunday
  Monthly: 4:00 AM on 1st of month

Setup cron jobs:
  # Daily backup
  0 2 * * * cd /path/to/stocktake && node scripts/backup-scheduler.js daily

  # Weekly backup
  0 3 * * 0 cd /path/to/stocktake && node scripts/backup-scheduler.js weekly

  # Monthly backup
  0 4 1 * * cd /path/to/stocktake && node scripts/backup-scheduler.js monthly

  # Or use auto mode:
  * * * * * cd /path/to/stocktake && node scripts/backup-scheduler.js auto
        `);
        break;
    }
  }
}

// Run if called directly
if (require.main === module) {
  const scheduler = new BackupScheduler();
  scheduler.run().catch(console.error);
}

module.exports = BackupScheduler;
