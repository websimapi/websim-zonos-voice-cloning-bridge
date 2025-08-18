const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs'); // Use synchronous fs for existsSync
const fsPromises = require('fs').promises;
const path = require('path');
const axios = require('axios');
const multer = require('multer');
const cors = require('cors');
const AdmZip = require('adm-zip');

const app = express();
const port = 3000;
const zonosPort = 7860;
const zonosRepo = 'https://github.com/Zyphra/Zonos.git';
const zonosDir = path.join(__dirname, 'Zonos');

const upload = multer({ dest: 'uploads/' });

// --- UTILITY FUNCTIONS ---
const log = (message) => console.log(`[SERVER] ${message}`);

const runCommand = (command, args, options = {}) => {
    return new Promise((resolve, reject) => {
        log(`Executing: ${command} ${args.join(' ')}`);
        const proc = spawn(command, args, { stdio: 'pipe', ...options });

        proc.stdout.on('data', (data) => console.log(data.toString()));
        proc.stderr.on('data', (data) => console.error(data.toString()));

        proc.on('close', (code) => {
            if (code !== 0) {
                reject(new Error(`Command failed with exit code ${code}: ${command} ${args.join(' ')}`));
            } else {
                resolve();
            }
        });
        proc.on('error', (err) => reject(err));
    });
};

const checkPathExists = async (path) => {
    try {
        await fsPromises.access(path);
        return true;
    } catch {
        return false;
    }
};

// --- ZONOS SETUP AND MANAGEMENT ---
let zonosProcess = null;

async function setupZonos() {
    log('--- Starting Zonos Setup ---');

    // 1. Check for Python 3
    try {
        await runCommand('python3', ['--version']);
        log('Python 3 is installed.');
    } catch (error) {
        log('ERROR: Python 3 is not installed or not in PATH. Please install it and try again.');
        process.exit(1);
    }
    
    // 2. Check for espeak-ng (inform user)
    log('INFO: Zonos requires espeak-ng. If not installed, please install it using your system package manager (e.g., `sudo apt-get install espeak-ng` or `brew install espeak-ng`).');

    // 3. Clone Zonos repo
    if (!(await checkPathExists(zonosDir))) {
        log(`Cloning Zonos repository from ${zonosRepo}...`);
        await runCommand('git', ['clone', zonosRepo, zonosDir]);
    } else {
        log('Zonos repository already exists.');
    }

    // 4. Create venv and install dependencies
    const venvDir = path.join(zonosDir, 'venv');
    const pythonExe = process.platform === 'win32' ? path.join(venvDir, 'Scripts', 'python.exe') : path.join(venvDir, 'bin', 'python');
    const pipExe = process.platform === 'win32' ? path.join(venvDir, 'Scripts', 'pip.exe') : path.join(venvDir, 'bin', 'pip');

    if (!(await checkPathExists(venvDir))) {
        log('Creating Python virtual environment...');
        await runCommand('python3', ['-m', 'venv', venvDir]);
        log('Installing dependencies with uv (this may take a long time)...');
        await runCommand(pipExe, ['install', 'uv']);
        await runCommand(pythonExe, ['-m', 'uv', 'pip', 'install', '-r', 'requirements.txt'], { cwd: zonosDir });
        log('Dependencies installed.');
    } else {
        log('Virtual environment already exists. Skipping dependency installation.');
    }

    // 5. Launch Zonos
    log(`Launching Zonos Gradio interface on http://localhost:${zonosPort}...`);
    zonosProcess = spawn(pythonExe, ['gradio_interface.py'], { cwd: zonosDir, stdio: 'pipe' });
    
    zonosProcess.stdout.on('data', (data) => console.log(`[ZONOS] ${data}`));
    zonosProcess.stderr.on('data', (data) => console.error(`[ZONOS_ERR] ${data}`));
    zonosProcess.on('close', (code) => {
        log(`Zonos process exited with code ${code}`);
        zonosProcess = null;
    });
    
    log('--- Zonos Setup Complete ---');
}

// --- EXPRESS SERVER ---
async function startServer() {
    await setupZonos();

    app.use(cors());
    app.use(express.static('public'));

    app.get('/health', async (req, res) => {
        if (!zonosProcess) {
            return res.status(503).json({ server_status: 'ok', zonos_status: 'stopped' });
        }
        try {
            // Check if the Gradio app is responsive
            await axios.get(`http://localhost:${zonosPort}`, { timeout: 1000 });
            res.json({ server_status: 'ok', zonos_status: 'running' });
        } catch (error) {
            res.status(503).json({ server_status: 'ok', zonos_status: 'starting_up' });
        }
    });

    app.get('/download-zip', (req, res) => {
        log('Request received to download project zip.');
        try {
            const zip = new AdmZip();
            
            const filesToZip = [
                'index.js',
                'package.json',
                'README.md',
                'dockerfile', // Note: filename might not have extension in some environments
                'docker-commands.sh'
            ];
            
            // Add root files that exist
            filesToZip.forEach(file => {
                const filePath = path.join(__dirname, file);
                if (fs.existsSync(filePath)) {
                    zip.addLocalFile(filePath);
                } else {
                    log(`Skipping non-existent file: ${file}`);
                }
            });
    
            // Add package-lock.json if it exists
            const packageLockPath = path.join(__dirname, 'package-lock.json');
            if (fs.existsSync(packageLockPath)) {
                zip.addLocalFile(packageLockPath);
            }
    
            // Add public folder
            const publicFolderPath = path.join(__dirname, 'public');
            if (fs.existsSync(publicFolderPath)) {
                zip.addLocalFolder(publicFolderPath, 'public');
            }

            const zipBuffer = zip.toBuffer();

            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', 'attachment; filename=zonos-web-bridge.zip');
            res.send(zipBuffer);

        } catch (error) {
            log(`Error creating zip file: ${error.message}`);
            res.status(500).json({ error: 'Failed to create project zip file.' });
        }
    });

    app.post('/tts', upload.single('audioReference'), async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ error: 'Reference audio file is required.' });
            }

            const { text, language, speed, temperature } = req.body;
            log(`Received TTS request for language: ${language}`);

            // 1. Read audio file and convert to base64 data URI
            const audioBuffer = await fsPromises.readFile(req.file.path);
            const mimeType = req.file.mimetype;
            const base64Audio = `data:${mimeType};base64,${audioBuffer.toString('base64')}`;

            // 2. Construct payload for Zonos Gradio API
            const payload = {
                // This fn_index assumes the main inference function is the first one in the Gradio interface
                fn_index: 0,
                data: [
                    text,
                    language,
                    { data: base64Audio, name: req.file.originalname }, // Reference audio
                    null, // Emotion dropdown, using null for default
                    parseFloat(speed),
                    parseFloat(temperature),
                    0.9,  // top_p (default)
                    50,   // top_k (default)
                    1,    // repetition_penalty (default)
                    true, // long_form_split (default)
                    true  // autoregressive_sampling (default)
                ]
            };
            
            // 3. Proxy request to Zonos
            log('Forwarding request to Zonos...');
            const zonosResponse = await axios.post(`http://localhost:${zonosPort}/run/predict`, payload);
            
            // 4. Extract, decode, and send audio back to client
            const outputAudioData = zonosResponse.data.data[0];
            const base64Content = outputAudioData.data.split(',')[1];
            const audioResultBuffer = Buffer.from(base64Content, 'base64');

            res.setHeader('Content-Type', 'audio/wav');
            res.send(audioResultBuffer);

        } catch (error) {
            console.error('TTS Error:', error.response ? error.response.data : error.message);
            res.status(500).json({ error: 'Failed to generate audio via Zonos.' });
        } finally {
            // Clean up uploaded file
            if (req.file) {
                await fsPromises.unlink(req.file.path);
            }
        }
    });

    app.listen(port, () => {
        log(`Server listening at http://localhost:${port}`);
        log('Open this URL in your browser to use the interface.');
    });
}

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});