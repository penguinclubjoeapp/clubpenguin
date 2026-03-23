FROM node:20-alpine

WORKDIR /app

# Install netcat for healthcheck
RUN apk add --no-cache netcat-openbsd

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Generate Prisma client and build TypeScript
ARG DATABASE_URL=mysql://placeholder:placeholder@localhost:3306/yukon
RUN npx prisma generate && npm run build

# Expose ports (Login: 6112, World: 6113)
EXPOSE 6112 6113

# Start both Login and World servers
CMD ["node", "dist/World.js", "Login", "Blizzard"]
