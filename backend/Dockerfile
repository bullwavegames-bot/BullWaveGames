FROM node:22-alpine AS dependencies
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

FROM dependencies AS build
WORKDIR /app
COPY backend ./backend
COPY shared ./shared
RUN npm run build --prefix backend

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist ./dist
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8787/health/live >/dev/null || exit 1
CMD ["node", "dist/backend/src/index.js"]
