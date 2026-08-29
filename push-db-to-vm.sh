#!/bin/bash
set -e

PROJECT_ID="your-gcp-project-id"
ZONE="us-west1-b"
VM_NAME="db-tracker"

if [ ! -f placement.db ]; then
    echo "❌ Error: Local placement.db not found!"
    exit 1
fi

echo "========================================="
echo "⚠️  WARNING: OVERWRITING REMOTE DATABASE"
echo "========================================="
echo "This will upload your local placement.db to the production VM."
read -p "Are you sure you want to overwrite production placement.db? (y/N): " -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "❌ Upload aborted."
    exit 0
fi

echo ""
echo "========================================="
echo "1. Uploading placement.db to VM..."
echo "========================================="
gcloud compute scp ./placement.db $VM_NAME:~/app-data/data/placement.db --zone=$ZONE --project=$PROJECT_ID

echo ""
echo "========================================="
echo "2. Restarting container on VM..."
echo "========================================="
gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT_ID --command="cd ~/app-data && docker compose restart app"

echo ""
echo "========================================="
echo "✅ Database pushed to VM and app restarted successfully!"
echo "========================================="
