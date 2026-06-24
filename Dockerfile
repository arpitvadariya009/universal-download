# Base image with Node.js 20
FROM node:20-bullseye-slim

# Install system dependencies: ffmpeg (for merging audio/video) and python3 (required by yt-dlp)
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3 \
    python3-pip \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install npm dependencies using legacy-peer-deps to avoid dependency resolution blocks
RUN npm install --legacy-peer-deps

# Copy application source code
COPY . .

# Build Next.js application
RUN npm run build

# Expose Next.js port (Render defaults to port 10000 or custom PORT env var, Next.js starts on 3000 by default)
ENV PORT=10000
EXPOSE 10000

# Start Next.js server
CMD ["npm", "start"]
