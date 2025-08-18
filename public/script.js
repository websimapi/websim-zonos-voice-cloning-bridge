document.addEventListener('DOMContentLoaded', () => {
    const ttsForm = document.getElementById('tts-form');
    const generateBtn = document.getElementById('generate-btn');
    const statusText = document.getElementById('status-text');
    const statusLight = document.getElementById('status-light');
    const audioOutput = document.getElementById('audio-output');
    const outputSection = document.getElementById('output-section');
    const loadingOverlay = document.getElementById('loading-overlay');
    const downloadZipBtn = document.getElementById('download-zip-btn');
    const downloadAudioLink = document.getElementById('download-audio-link');

    const speedSlider = document.getElementById('speed');
    const speedValue = document.getElementById('speed-value');
    const temperatureSlider = document.getElementById('temperature');
    const temperatureValue = document.getElementById('temperature-value');

    // Update slider value displays
    speedSlider.addEventListener('input', () => speedValue.textContent = speedSlider.value);
    temperatureSlider.addEventListener('input', () => temperatureValue.textContent = temperatureSlider.value);


    const checkServerStatus = async () => {
        try {
            const response = await fetch('/health');
            if (response.ok) {
                const data = await response.json();
                if (data.zonos_status === 'running') {
                    statusText.textContent = 'Zonos Ready';
                    statusLight.classList.remove('inactive');
                    statusLight.classList.add('active');
                    generateBtn.disabled = false;
                } else {
                    statusText.textContent = 'Zonos Not Ready';
                    statusLight.classList.remove('active');
                    statusLight.classList.add('inactive');
                    generateBtn.disabled = true;
                }
            } else {
                throw new Error('Server not reachable');
            }
        } catch (error) {
            statusText.textContent = 'Server Unreachable';
            statusLight.classList.remove('active');
            statusLight.classList.add('inactive');
            generateBtn.disabled = true;
        }
    };

    ttsForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        loadingOverlay.hidden = false;
        generateBtn.disabled = true;
        generateBtn.setAttribute('aria-busy', 'true');
        downloadAudioLink.hidden = true;

        const formData = new FormData(ttsForm);
        
        try {
            const response = await fetch('/tts', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'An unknown error occurred.');
            }

            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            
            audioOutput.src = audioUrl;
            downloadAudioLink.href = audioUrl;
            downloadAudioLink.hidden = false;
            outputSection.hidden = false;
            audioOutput.play();

        } catch (error) {
            alert(`Error generating audio: ${error.message}`);
        } finally {
            loadingOverlay.hidden = true;
            generateBtn.disabled = false;
            generateBtn.removeAttribute('aria-busy');
        }
    });

    downloadZipBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        const originalText = downloadZipBtn.textContent;
        downloadZipBtn.setAttribute('aria-busy', 'true');
        downloadZipBtn.textContent = 'Zipping...';

        try {
            const response = await fetch('/download-zip');
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Server responded with status ${response.status}`);
            }
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.style.display = 'none';
            a.href = url;
            a.download = 'zonos-web-bridge.zip';
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
        } catch (error) {
            alert(`Failed to download project ZIP: ${error.message}`);
        } finally {
            downloadZipBtn.removeAttribute('aria-busy');
            downloadZipBtn.textContent = originalText;
        }
    });

    // Initial and periodic health checks
    checkServerStatus();
    setInterval(checkServerStatus, 10000); // Check every 10 seconds
});