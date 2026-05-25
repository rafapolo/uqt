FROM node:18-alpine

WORKDIR /app

# tocador submodule owns the proxy and its dependencies
COPY tocador/package*.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY tocador/proxy.js .

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Health check with proper error handling
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9001/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)}).on('error', () => process.exit(1))"

# Expose port
EXPOSE 9001

# Start proxy with proper signal handling
CMD ["node", "--enable-source-maps", "proxy.js"]
