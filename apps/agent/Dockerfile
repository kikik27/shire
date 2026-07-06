FROM node:20-alpine
WORKDIR /app

# Copy root workspace files needed for npm workspaces + tsconfig
COPY package.json package-lock.json turbo.json tsconfig.base.json ./
COPY apps/agent/package.json ./apps/agent/
COPY packages/shared/package.json ./packages/shared/

# Install all workspace deps from root (includes tsx)
RUN npm install --ignore-scripts

# Copy agent source
COPY apps/agent/src ./apps/agent/src
COPY apps/agent/tsconfig.json ./apps/agent/

# Copy shared package source (exported as raw TypeScript, resolved by tsx at runtime)
COPY packages/shared/src ./packages/shared/src

WORKDIR /app/apps/agent

RUN mkdir -p .data

EXPOSE 3010

# Run source directly with tsx — Railway injects env vars natively
CMD ["node", "--import", "tsx/esm", "src/server.ts"]
