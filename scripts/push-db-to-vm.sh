#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load configuration from .env if present
if [ -f "$ROOT_DIR/.env" ]; then
    set -a
    source "$ROOT_DIR/.env"
    set +a
fi

PROJECT_ID="${GCP_PROJECT_ID:?Error: GCP_PROJECT_ID is not set. Please define it in .env or your environment.}"
ZONE="${GCP_ZONE:-us-west1-b}"
VM_NAME="${GCP_VM_NAME:-db-tracker}"

if [ ! -f "$ROOT_DIR/placement.db" ]; then
    echo "❌ Error: Local placement.db not found at $ROOT_DIR/placement.db!"
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
gcloud compute scp "$ROOT_DIR/placement.db" $VM_NAME:~/app-data/data/placement.db --zone=$ZONE --project=$PROJECT_ID

echo ""
echo "========================================="
echo "2. Restarting container on VM..."
echo "========================================="
gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT_ID --command="cd ~/app-data && docker compose restart app"

echo ""
echo "========================================="
echo "✅ Database pushed to VM and app restarted successfully!"
echo "========================================="
