FROM node:18-alpine

WORKDIR /app

# Copy package files if they exist
COPY package*.json ./

# Install dependencies (or skip if no package.json)
RUN if [ -f package.json ]; then npm install --production; else echo "No package.json found"; fi

# Copy application code
COPY proxy.js .
COPY js/ ./js/

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:9001/uqt/health', (r) => {if (r.statusCode !== 200) throw new Error(r.statusCode)})"

# Expose port
EXPOSE 9001

# Start proxy
CMD ["node", "proxy.js"]
