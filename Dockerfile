FROM oven/bun:latest AS builder

WORKDIR /app

COPY package.json ./

RUN bun install --frozen-lockfile

COPY . .

RUN bun run build

FROM oven/bun:latest 

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./

EXPOSE 3000
ENV NODE_ENV=production
ENV HOST=0.0.0.0

CMD ["bun", "run", "start"]
