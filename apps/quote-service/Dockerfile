FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json core.mjs shopify.mjs server.mjs ./
RUN mkdir /app/data && chown node:node /app/data
USER node
ENV PORT=3000 DATABASE_PATH=/app/data/quotes.sqlite
EXPOSE 3000
CMD ["node", "server.mjs"]
