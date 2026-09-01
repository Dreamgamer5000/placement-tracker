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
REGION="${GCP_REGION:-us-west1}"
ZONE="${GCP_ZONE:-us-west1-b}"
VM_NAME="${GCP_VM_NAME:-db-tracker}"
REPO_NAME="${GCP_REPO_NAME:-tracker-repo}"
IMAGE_NAME="${REGION}-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/tracker-app:latest"

echo "========================================="
echo "1. Building Docker image locally..."
echo "========================================="
cd "$ROOT_DIR"
docker build -t $IMAGE_NAME .

echo ""
echo "========================================================"
echo "💡 Image built successfully!"
echo "   You can test it locally anytime with: npm run docker:test"
echo "========================================================"
read -p "Proceed with pushing to Artifact Registry and updating VM? (y/N): " -r CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "❌ Deployment aborted. No changes pushed to production."
    exit 0
fi

echo ""
echo "========================================="
echo "2. Pushing image to Google Artifact Registry..."
echo "========================================="
docker push $IMAGE_NAME

echo ""
echo "========================================="
echo "3. Updating VM..."
echo "========================================="
# Ensure app-data folder exists and copy configuration files
gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT_ID --command="mkdir -p ~/app-data/data"
gcloud compute scp vm-setup/docker-compose.yml $VM_NAME:~/app-data/ --zone=$ZONE --project=$PROJECT_ID
if [ -f .env ]; then
    gcloud compute scp .env $VM_NAME:~/app-data/.env --zone=$ZONE --project=$PROJECT_ID
fi

# Pull the latest image and restart the containers on the VM
gcloud compute ssh $VM_NAME --zone=$ZONE --project=$PROJECT_ID --command="gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet && cd ~/app-data && docker compose pull && docker compose up -d"

echo ""
echo "========================================="
echo "✅ Deployment Complete!"
echo "========================================="
