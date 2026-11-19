#!/bin/bash
set -e

BACKUP_DIR="/root/backups/daily"
mkdir -p "$BACKUP_DIR"

DATE_STR=$(date +%Y-%m-%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/shastika_backup_${DATE_STR}.sql"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Starting automated PostgreSQL backup of shastika_whatsapp_bot..."
sudo -u postgres pg_dump -d shastika_whatsapp_bot > "$BACKUP_FILE"

FILE_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup created: $BACKUP_FILE ($FILE_SIZE)"

# 14-day retention: Remove backup files older than 14 days
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cleaning up daily backups older than 14 days in $BACKUP_DIR..."
DELETED_FILES=$(find "$BACKUP_DIR" -name "*.sql" -type f -mtime +14 -print -delete || true)
if [ -n "$DELETED_FILES" ]; then
  echo "Pruned old backups:"
  echo "$DELETED_FILES"
else
  echo "No backups older than 14 days found."
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Automated backup and retention pass complete."
