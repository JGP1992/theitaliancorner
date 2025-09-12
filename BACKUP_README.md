# Stocktake Backup & Restore System

A comprehensive backup, restore, and data integrity system for the Stocktake application.

## Features

- **Automated Backups**: Scheduled daily, weekly, and monthly backups
- **Data Validation**: Comprehensive integrity checks for database consistency
- **Flexible Restore**: Restore from backups with validation and dry-run options
- **Multiple Formats**: JSON backups with optional compression and SQL export
- **Cleanup Automation**: Automatic removal of old backups
- **Health Monitoring**: System health checks and integrity reports

## Quick Start

### Create a Backup
```bash
npm run backup
```

### List Available Backups
```bash
npm run backup:list
```

### Restore from Backup
```bash
npm run backup:restore backups/backup-2024-01-01.json
```

### Validate Data Integrity
```bash
npm run validate:data
```

## Backup Commands

### Manual Backup
```bash
# Create backup with default name
npm run backup

# Create backup with custom name
node scripts/backup-restore.js backup my-custom-backup
```

### Automated Backups
```bash
# Daily backup (runs at 2:00 AM)
npm run backup:daily

# Weekly backup (runs Sunday at 3:00 AM)
npm run backup:weekly

# Monthly backup (runs 1st of month at 4:00 AM)
npm run backup:monthly

# Auto-select appropriate backup based on schedule
npm run backup:auto
```

### Backup Management
```bash
# List all backups
npm run backup:list

# Clean up backups older than 30 days
npm run backup:cleanup

# Clean up backups older than 7 days
node scripts/backup-restore.js cleanup 7

# Export backup to SQL format
npm run backup:export-sql backups/backup-2024-01-01.json
```

## Restore Commands

### Basic Restore
```bash
# Restore from backup
npm run backup:restore backups/backup-2024-01-01.json
```

### Advanced Restore Options
```bash
# Dry run (test restore without making changes)
node scripts/backup-restore.js restore backup.json --dry-run

# Skip validation during restore
node scripts/backup-restore.js restore backup.json --skip-validation

# Clear existing data before restore
node scripts/backup-restore.js restore backup.json --clear-existing

# Combine options
node scripts/backup-restore.js restore backup.json --dry-run --clear-existing
```

## Data Validation

### Database Integrity Check
```bash
npm run validate:data
```

### Backup File Validation
```bash
npm run validate:backup backups/backup-2024-01-01.json
```

### Generate Integrity Report
```bash
npm run validate:report
```

## Scheduling with Cron

Set up automated backups using cron jobs:

```bash
# Daily backup at 2:00 AM
0 2 * * * cd /path/to/stocktake && npm run backup:daily

# Weekly backup every Sunday at 3:00 AM
0 3 * * 0 cd /path/to/stocktake && npm run backup:weekly

# Monthly backup on 1st of month at 4:00 AM
0 4 1 * * cd /path/to/stocktake && npm run backup:monthly

# Health check every hour
0 * * * * cd /path/to/stocktake && npm run backup:health

# Or use auto mode (checks schedule every minute)
* * * * * cd /path/to/stocktake && npm run backup:auto
```

## Backup Structure

Backups are stored in the `backups/` directory with the following structure:

```
backups/
├── backup-2024-01-01T10-30-00.json          # JSON backup
├── backup-2024-01-01T10-30-00.json.gz       # Compressed backup
├── daily-backup-2024-01-01.json             # Daily scheduled backup
├── weekly-backup-2024-01-01.json            # Weekly scheduled backup
├── monthly-backup-2024-01-01.json           # Monthly scheduled backup
└── integrity-report-1704110400000.json      # Integrity report
```

## Data Integrity Checks

The system validates:

- **Foreign Key Constraints**: Ensures all relationships are valid
- **Data Consistency**: Checks for negative quantities, future dates
- **Orphaned Records**: Finds records without required relationships
- **Duplicates**: Identifies duplicate usernames, item names
- **Business Rules**: Validates calculated totals match stored values
- **Backup Completeness**: Ensures backups contain all required data

## Configuration

### Environment Variables
```env
# Database connection (inherited from main app)
DATABASE_URL="file:./dev.db"

# Backup settings
BACKUP_RETENTION_DAYS=30
BACKUP_COMPRESSION=true
```

### Backup Schedule Configuration
Modify `scripts/backup-scheduler.js` to customize schedules:

```javascript
this.schedule = {
  daily: { hour: 2, minute: 0 },      // 2:00 AM daily
  weekly: { day: 0, hour: 3, minute: 0 },   // Sunday 3:00 AM
  monthly: { day: 1, hour: 4, minute: 0 }   // 1st of month 4:00 AM
};
```

## Security Considerations

- Backups contain sensitive data (user credentials, business data)
- Store backups in secure locations
- Use encryption for backups in production
- Implement access controls for backup files
- Regularly audit backup access logs

## Troubleshooting

### Common Issues

**Backup fails with permission error**
```bash
# Ensure backup directory is writable
chmod 755 backups/
```

**Restore fails with foreign key errors**
```bash
# Use --clear-existing flag to clear data first
npm run backup:restore backup.json --clear-existing
```

**Large backups causing memory issues**
```bash
# Enable compression
# The system automatically compresses backups
```

**Validation finds many issues**
```bash
# Generate detailed report
npm run validate:report

# Review and fix issues manually or with migration scripts
```

### Recovery Procedures

1. **Data Loss Recovery**
   ```bash
   # List available backups
   npm run backup:list

   # Validate backup integrity
   npm run validate:backup backup-file.json

   # Perform dry run restore
   node scripts/backup-restore.js restore backup-file.json --dry-run

   # Execute restore
   npm run backup:restore backup-file.json
   ```

2. **Corrupted Database Recovery**
   ```bash
   # Stop the application
   # Restore from last good backup
   npm run backup:restore last-good-backup.json --clear-existing

   # Validate restored data
   npm run validate:data
   ```

## Monitoring

### Health Checks
```bash
npm run backup:health
```

This checks:
- Number of available backups
- Age of most recent backup
- Backup directory accessibility
- Disk space availability

### Automated Monitoring
Set up monitoring alerts for:
- Failed backup attempts
- Missing scheduled backups
- Low disk space
- Data integrity issues

## Best Practices

1. **Test Restores Regularly**: Perform dry-run restores monthly
2. **Monitor Disk Space**: Ensure adequate space for backups
3. **Validate Backups**: Always validate backup integrity after creation
4. **Secure Storage**: Store backups in secure, off-site locations
5. **Version Control**: Keep multiple backup versions
6. **Documentation**: Document backup and restore procedures
7. **Access Control**: Limit access to backup files and scripts

## API Integration

The backup system can be integrated with external monitoring and alerting systems:

```javascript
const { BackupRestoreManager } = require('./scripts/backup-restore');

const manager = new BackupRestoreManager();

// Create backup
const result = await manager.createBackup('api-backup');

// Validate integrity
const validator = new DataIntegrityValidator();
const integrity = await validator.validateDatabaseIntegrity();

// Send alerts based on results
if (!result.success) {
  // Send alert for failed backup
}
if (integrity.issues > 0) {
  // Send alert for data integrity issues
}
```

## Support

For issues or questions:
1. Check the integrity report: `npm run validate:report`
2. Review backup logs in the console output
3. Test with dry-run mode before actual operations
4. Ensure proper file permissions and disk space
