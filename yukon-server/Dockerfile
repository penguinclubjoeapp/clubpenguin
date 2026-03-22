FROM node:20-alpine

WORKDIR /app

# Install netcat for healthcheck
RUN apk add --no-cache netcat-openbsd

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Expose ports (Login: 6112, World: 6113)
EXPOSE 6112 6113

# Start both Login and World servers
CMD ["node", "dist/World.js", "Login", "Blizzard"]
