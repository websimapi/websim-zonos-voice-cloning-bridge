# Zonos Local Web UI Bridge

This project provides a simple, self-contained Node.js web server that acts as a bridge to the [Zyphra Zonos](https://github.com/Zyphra/Zonos) voice cloning tool. It allows you to use Zonos through a user-friendly web interface in your browser, without needing to interact with the command line after the initial setup.

On the first run, the server will automatically:
1.  Clone the Zonos repository.
2.  Create a Python virtual environment.
3.  Install all required Python dependencies.
4.  Launch the Zonos Gradio backend.

Subsequent runs will start the server much faster.

## Features

-   **Web Interface:** Easy-to-use UI for text-to-speech conversion.
-   **Zero-Shot TTS:** Clone a voice from a 10-30 second audio sample.
-   **Multilingual Support:** Includes controls for various languages supported by Zonos.
-   **Fine-Grained Control:** Adjust speed and creativity (temperature) of the generated speech.
-   **Automated Setup:** Clones the repo and installs dependencies on first launch.
-   **Proxy Server:** Securely bridges browser requests to the local Python service.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

-   **Node.js and npm:** [Download Here](https://nodejs.org/) (v18 or higher recommended)
-   **Python:** v3.10 or v3.11 ([Download Here](https://www.python.org/))
-   **Git:** [Download Here](https://git-scm.com/)
-   **espeak-ng:** This is a system dependency required by Zonos.
    -   **Ubuntu/Debian:** `sudo apt-get update && sudo apt-get install espeak-ng`
    -   **macOS (Homebrew):** `brew install espeak-ng`
    -   **Windows:** May require manual installation via WSL or other package managers.

### Hardware Requirements

-   **GPU (Recommended):** An NVIDIA GPU with at least 8GB of VRAM is highly recommended for fast inference. Ensure you have CUDA drivers installed.
-   **CPU Fallback:** The model can run on the CPU, but it will be significantly slower.

## Setup and Running

1.  **Download and Unzip:**
    Download the project files and extract them to a new folder on your computer.

2.  **Install Node.js Dependencies:**
    Open a terminal or command prompt, navigate into the project folder, and run:
    ```bash
    npm install
    ```

3.  **Start the Server:**
    Run the following command to start the server:
    ```bash
    node index.js
    ```

    **Important:** The first time you run this command, it will take a **very long time** (10-30 minutes or more depending on your internet and computer speed) as it downloads the Zonos repository, its dependencies, and the model weights. You will see a lot of output in the terminal.

4.  **Access the Web UI:**
    Once you see the message `Server listening at http://localhost:3000`, open your web browser and navigate to:
    [http://localhost:3000](http://localhost:3000)

## How to Use

1.  **Check Status:** The "Server Status" light in the UI should turn green and say "Zonos Ready". This might take a minute after starting the server as the Python backend loads.
2.  **Upload Audio:** Click "Choose File" and select a high-quality `.wav` or `.mp3` file of someone speaking for 10-30 seconds.
3.  **Select Language:** Choose the language of the text you are about to enter.
4.  **Enter Text:** Type the text you want the cloned voice to say.
5.  **Adjust Controls (Optional):** Modify the speed and creativity sliders for different results.
6.  **Generate:** Click the "Generate" button. The process may take a few moments.
7.  **Playback:** The generated audio will appear and can be played directly from the browser.

## Optional Docker Workflow

For a more isolated environment, you can use Docker. Create a `Dockerfile` in the project root with the following content:

```Dockerfile
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

