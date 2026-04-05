# Use a lightweight Node.js 20 image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first (for caching)
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy the rest of your app's source code
COPY . .

# Expose the port your bot runs on (change if it's not 3000)
EXPOSE 3000

# Command to start your application
CMD ["npm", "start"]
