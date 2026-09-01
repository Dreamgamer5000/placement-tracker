#!/bin/bash
set -e

PROJECT_ID="your-gcp-project-id"
REGION="us-west1"
REPO_NAME="tracker-repo"

echo "========================================="
echo "Enabling Artifact Registry API..."
echo "========================================="
gcloud services enable artifactregistry.googleapis.com --project=$PROJECT_ID

echo ""
echo "========================================="
echo "Creating Docker repository..."
echo "========================================="
if ! gcloud artifacts repositories describe $REPO_NAME --location=$REGION --project=$PROJECT_ID >/dev/null 2>&1; then
    gcloud artifacts repositories create $REPO_NAME \
        --repository-format=docker \
        --location=$REGION \
        --description="Docker repository for tracker app" \
        --project=$PROJECT_ID
else
    echo "Repository $REPO_NAME already exists."
fi

echo ""
echo "========================================="
echo "Configuring Docker authentication..."
echo "========================================="
gcloud auth configure-docker ${REGION}-docker.pkg.dev --quiet

echo ""
echo "========================================="
echo "Opening GCP Firewall for ports 80 and 443..."
echo "========================================="
if ! gcloud compute firewall-rules describe allow-tracker-app --project=$PROJECT_ID >/dev/null 2>&1; then
    gcloud compute firewall-rules create allow-tracker-app \
        --allow tcp:80,tcp:443 \
        --target-tags http-server \
        --project=$PROJECT_ID
else
    echo "Firewall rule already exists."
fi

# Attach network tag to VM
gcloud compute instances add-tags db-tracker \
    --tags http-server \
    --zone=us-west1-b \
    --project=$PROJECT_ID

echo ""
echo "========================================="
echo "Installing Docker on the VM (this takes a minute)..."
echo "========================================="
gcloud compute ssh db-tracker \
    --zone=us-west1-b \
    --project=$PROJECT_ID \
    --command="sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 && sudo usermod -aG docker \$USER"

echo ""
echo "========================================="
echo "✅ First-time setup complete!"
echo "========================================="
echo "NOTE: The VM might need a reboot or a re-login for the docker group changes to take effect."
