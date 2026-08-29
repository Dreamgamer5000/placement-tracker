#!/bin/bash
set -e

PROJECT_ID="your-gcp-project-id"
ZONE="us-west1-b"
VM_NAME="db-tracker"

echo "========================================="
echo "1. Downloading placement.db from VM..."
echo "========================================="
gcloud compute scp $VM_NAME:~/app-data/data/placement.db ./placement.db --zone=$ZONE --project=$PROJECT_ID

echo ""
echo "========================================="
echo "2. Creating SQL backup (backup.sql)..."
echo "========================================="
sqlite3 placement.db .dump > backup.sql

echo ""
echo "========================================="
echo "✅ Database pulled from VM and backup.sql created!"
echo "========================================="
