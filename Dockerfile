# Production-ready Node.js proxy for UQT
FROM node:18-alpine

WORKDIR /app

# Copy package files if they exist
COPY package*.json ./

# Install dependencies (or skip if no package.json)
RUN if [ -f package.json ]; then npm install --production && npm cache clean --force; else echo "No package.json found"; fi

# Copy application code
COPY proxy.js .
COPY js/ ./js/

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
