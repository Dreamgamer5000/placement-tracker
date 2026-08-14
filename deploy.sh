#!/bin/bash
set -e

# Configuration
PROJECT_ID="your-gcp-project-id"
REGION="us-west1"
REPO_NAME="tracker-repo"
IMAGE_NAME="us-west1-docker.pkg.dev/$PROJECT_ID/$REPO_NAME/tracker-app:latest"

echo "========================================="
echo "1. Building Docker image locally..."
echo "========================================="
docker build -t $IMAGE_NAME .

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
gcloud compute ssh db-tracker --zone=us-west1-b --project=$PROJECT_ID --command="mkdir -p ~/app-data/data"
gcloud compute scp vm-setup/docker-compose.yml vm-setup/Caddyfile db-tracker:~/app-data/ --zone=us-west1-b --project=$PROJECT_ID

# Pull the latest image and restart the containers on the VM
gcloud compute ssh db-tracker --zone=us-west1-b --project=$PROJECT_ID --command="gcloud auth configure-docker us-west1-docker.pkg.dev --quiet && cd ~/app-data && docker compose pull && docker compose up -d"

echo ""
echo "========================================="
echo "✅ Deployment Complete! "
echo "========================================="
