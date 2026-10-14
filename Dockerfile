FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN chmod +x docker-start.sh

ENV DATABASE_URL=postgresql://user:pass@localhost:5432/placeholder
# Next.js inlines NEXT_PUBLIC_* at build time, and Railway only passes
# service variables into a Dockerfile build when they're declared here.
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["./docker-start.sh"]
