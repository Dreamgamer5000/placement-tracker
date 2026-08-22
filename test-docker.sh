#!/bin/bash
set -e

PORT=3005
CONTAINER_NAME="tracker-local-test"

echo "========================================="
echo "🛠️  1. Building Docker image locally..."
echo "========================================="
docker build -t tracker-local .

echo ""
echo "========================================="
echo "🚀 2. Running container locally..."
echo "========================================="
echo "App will be available at: http://localhost:$PORT"
echo "Press Ctrl+C to stop the test container."
echo "========================================="

# Stop existing test container if running
docker rm -f $CONTAINER_NAME 2>/dev/null || true

# Run container (removes itself upon exit)
docker run --init --rm -it \
  --name $CONTAINER_NAME \
  --env-file .env \
  -p ${PORT}:3001 \
  -v "$(pwd)/placement.db:/app/placement.db" \
  -e NODE_ENV=production \
  -e DB_PATH=placement.db \
  tracker-local
