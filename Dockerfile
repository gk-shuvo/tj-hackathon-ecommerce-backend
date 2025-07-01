# Use an official Node.js LTS image
FROM node:18-alpine

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./
RUN npm install --production

# Bundle app source
COPY . .

# Expose the app port
EXPOSE 3000

# Start the server
CMD ["node", "src/server.js"]
