FROM node:20-alpine

ENV NODE_ENV=production
WORKDIR /app

# Patch OS packages (fixes the openssl, musl and zlib findings)
RUN apk upgrade --no-cache

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
              /opt/yarn-v1.22.22 /usr/local/bin/yarn /usr/local/bin/yarnpkg

COPY app.js ./

# Run as the built-in non-root user instead of root
USER node

EXPOSE 3000
CMD ["node", "app.js"]