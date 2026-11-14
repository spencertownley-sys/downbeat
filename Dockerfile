FROM node:20-alpine

WORKDIR /app
# Build and run as the unprivileged `node` user that ships with the image, so
# a compromise of the Node process doesn't get root in the container. Owning
# the files from the start avoids a `chown -R` layer that would double the
# size of node_modules.
RUN chown node:node /app
USER node

COPY --chown=node:node package.json package-lock.json ./
RUN npm ci

COPY --chown=node:node . .
RUN chmod +x docker-start.sh

ENV DATABASE_URL=postgresql://user:pass@localhost:5432/placeholder
# Next.js inlines NEXT_PUBLIC_* at build time, and Railway only passes
# service variables into a Dockerfile build when they're declared here.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["./docker-start.sh"]
