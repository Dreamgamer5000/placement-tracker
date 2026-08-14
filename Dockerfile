FROM node:24-slim

WORKDIR /app

# Install system libs (better-sqlite3 requirement)
RUN apt-get update && apt-get install -y python3 g++ make && rm -rf /var/lib/apt/lists/*

# Install deps first (cache layer)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Build the project (frontend and backend)
RUN npm run build

# Expose port
EXPOSE 3001

CMD ["node", "dist/backend/index.js"]
