# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
ENV NODE_ENV=production \
    PORT=8097 \
    DATA_DIR=/data \
    WEB_DIR=/app/web \
    NODE_OPTIONS=--disable-warning=ExperimentalWarning
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY web/package.json web/
RUN npm ci --omit=dev -w server --no-audit --no-fund && npm cache clean --force
COPY server/assets server/assets
COPY --from=build /app/server/dist server/dist
COPY --from=build /app/web/dist web
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 8097
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/state').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", "server/dist/index.js"]
