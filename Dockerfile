FROM node:24-slim

WORKDIR /app

# Install deps first (cache layer)
COPY package*.json ./
RUN npm install

# Copy source
COPY . .

# Expose both ports
EXPOSE 3000

CMD ["npm", "run", "dev:backend"]
