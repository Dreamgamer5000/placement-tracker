#!/bin/bash
set -e

# Project configuration
PROJECT_ID="your-gcp-project-id"
ZONE="us-west1-b"
VM_NAME="db-tracker"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

mkdir -p "$ROOT_DIR/backups"

echo "========================================="
echo "1. Downloading placement.db from VM..."
echo "========================================="
gcloud compute scp $VM_NAME:~/app-data/data/placement.db "$ROOT_DIR/placement.db" --zone=$ZONE --project=$PROJECT_ID

echo ""
echo "========================================="
echo "2. Creating SQL backup (backups/backup.sql)..."
echo "========================================="
sqlite3 "$ROOT_DIR/placement.db" .dump > "$ROOT_DIR/backups/backup.sql"

echo ""
echo "========================================="
echo "✅ Database pulled from VM and backup saved in backups/backup.sql!"
echo "========================================="
