FROM --platform=linux/arm64 oven/bun:latest AS builder

WORKDIR /app

# Install necessary dependencies
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Copy only package files first to leverage Docker cache
COPY package.json bun.lockb ./
RUN bun install --frozen-lockfile

# Copy prisma schema for generation
COPY prisma ./prisma/

# Generate Prisma client early in the build process
ENV NODE_ENV=production
RUN bunx prisma generate

# Copy the rest of the app
COPY . .

# Build the application
RUN bun run build

# Second stage for the final image
FROM --platform=linux/arm64 oven/bun:latest

WORKDIR /app

# Install runtime dependencies
RUN apt-get update -y && apt-get install -y openssl ca-certificates

# Copy only necessary files from the builder stage
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/dist ./dist

# Explicitly set the platform for clarity
ENV NODE_ENV=production
ENV PRISMA_SCHEMA_ENGINE_BINARY=/app/node_modules/.prisma/client/libquery_engine-linux-arm64-openssl-3.0.x.so.node
ENV PRISMA_QUERY_ENGINE_BINARY=/app/node_modules/.prisma/client/libquery_engine-linux-arm64-openssl-3.0.x.so.node

# Set appropriate permissions
RUN chmod -R 755 /app/node_modules/.prisma

EXPOSE 3000

CMD ["bun", "run", "start"]