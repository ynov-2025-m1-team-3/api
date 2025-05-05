FROM --platform=linux/amd64 oven/bun:latest AS builder

RUN mkdir -p /app && \
    adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app

WORKDIR /app
USER appuser

COPY --chown=appuser:appuser package.json .
COPY --chown=appuser:appuser prisma ./prisma/

# Copy only package files first to leverage Docker cache
COPY package.json bun.lockb ./
RUN bun install

RUN bunx prisma generate

COPY --chown=appuser:appuser . .
RUN bun run build

FROM oven/bun:latest

RUN mkdir -p /app && \
    adduser --disabled-password --gecos "" appuser && \
    chown -R appuser:appuser /app

WORKDIR /app
USER appuser

COPY --from=builder --chown=appuser:appuser /app .

EXPOSE 3000
ENV NODE_ENV=production
CMD ["bun", "run", "start"]