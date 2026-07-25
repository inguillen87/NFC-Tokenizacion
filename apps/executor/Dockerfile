FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d

ENV NODE_ENV=production \
    PORT=8080

WORKDIR /srv/nexid

COPY package.json package-lock.json ./
COPY apps/executor/package.json apps/executor/package.json
RUN npm ci --omit=dev --workspace=executor \
    && npm cache clean --force

COPY apps/executor/src apps/executor/src

WORKDIR /srv/nexid/apps/executor
USER node
EXPOSE 8080

CMD ["node", "src/server.mjs"]
