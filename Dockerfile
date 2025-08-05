# Use an official Node.js LTS image
FROM node:18-alpine

# Install tini for proper signal handling and wget for health checks
RUN apk add --no-cache tini wget

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Expose the app port
EXPOSE 3000

# Use tini as entrypoint for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start the server
CMD ["node", "src/server.js"]
