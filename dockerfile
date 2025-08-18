# Use a base image with Node.js and Python
FROM node:18

# Install system dependencies for Zonos
RUN apt-get update && apt-get install -y \
    git \
    python3-venv \
    espeak-ng \
    build-essential

# Set up the application directory
WORKDIR /usr/src/app

# Copy package files and install Node.js dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application source code
COPY . .

# Expose the ports for the Node server and the Zonos Gradio app
EXPOSE 3000
EXPOSE 7860

# Start the application
CMD [ "node", "index.js" ]