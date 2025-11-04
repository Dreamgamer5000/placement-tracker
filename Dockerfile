FROM node:24-slim

WORKDIR /app

# Install system libs (better-sqlite3 requirement)
RUN apt-get update && apt-get install -y python3 g++ make && rm -rf /var/lib/apt/lists/*

# Install deps first (cache layer)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose both ports
EXPOSE 3000

CMD ["npm", "run", "dev:backend"]
