FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=8787
ENV DATA_DIR=/data
VOLUME /data
EXPOSE 8787
CMD ["node", "server/index.mjs"]
