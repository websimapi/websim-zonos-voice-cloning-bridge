# Build the Docker image
docker build -t zonos-bridge .

# Run the container, mapping the ports
# For GPU support, you need the NVIDIA Container Toolkit
docker run --gpus all -p 3000:3000 -p 7860:7860 zonos-bridge

