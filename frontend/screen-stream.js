// Screen streaming using WebRTC and WebCodecs
class ScreenStreamer {
  constructor() {
    this.deviceSelect = document.getElementById('screenDeviceSelect');
    this.refreshButton = document.getElementById('screenRefresh');
    this.canvas = document.getElementById('screenCanvas');
    this.video = document.getElementById('screenSource');
    this.statusElement = document.getElementById('screenStatus');

    this.ctx = this.canvas.getContext('2d');
    this.connection = null;
    this.decoder = null;

    this.init();
  }

  init() {
    this.populateDeviceSelect();
    this.deviceSelect.addEventListener('change', () => this.startStreaming());
    this.refreshButton.addEventListener('click', () => this.startStreaming());
  }

  populateDeviceSelect() {
    this.deviceSelect.innerHTML = '<option value="">Select device</option>';
    window.__DEVICES__.filter(d => d.type === 'adb').forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = `${device.name} (${device.serial || 'disconnected'})`;
      this.deviceSelect.appendChild(option);
    });
  }

  async startStreaming() {
    const deviceId = this.deviceSelect.value;
    if (!deviceId) {
      this.showStatus('Select a device to start streaming');
      return;
    }

    this.showStatus('Initializing stream...');

    try {
      // Initialize WebRTC connection using RTCMultiConnection
      this.connection = new RTCMultiConnection();
      this.connection.socketURL = `ws://localhost:3000/ws/screen/${deviceId}`;

      this.connection.session = {
        audio: false,
        video: true,
        data: true
      };

      this.connection.onstream = (event) => {
        this.video.srcObject = event.stream;
        this.video.play();
        this.showStatus('Streaming active');
        this.initDecoder();
      };

      this.connection.onstreamended = () => {
        this.showStatus('Stream ended');
        this.cleanup();
      };

      await this.connection.openOrJoin(deviceId);

    } catch (error) {
      this.showStatus(`Streaming failed: ${error.message}`);
      console.error('Streaming error:', error);
    }
  }

  async initDecoder() {
    if (!('VideoDecoder' in window)) {
      this.showStatus('WebCodecs not supported, falling back to video element');
      this.video.style.display = 'block';
      return;
    }

    try {
      this.decoder = new VideoDecoder({
        output: (frame) => this.renderFrame(frame),
        error: (error) => console.error('Decoder error:', error)
      });

      // Configure decoder for H.264
      await this.decoder.configure({
        codec: 'avc1.42E01E',
        codedWidth: 720,
        codedHeight: 1280
      });

      this.showStatus('Using WebCodecs for smooth rendering');
    } catch (error) {
      console.warn('WebCodecs init failed, using video element:', error);
      this.video.style.display = 'block';
    }
  }

  renderFrame(frame) {
    this.canvas.width = frame.displayWidth;
    this.canvas.height = frame.displayHeight;
    this.ctx.drawImage(frame, 0, 0);
    frame.close();
  }

  showStatus(message) {
    this.statusElement.textContent = message;
  }

  cleanup() {
    if (this.decoder) {
      this.decoder.close();
      this.decoder = null;
    }
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    this.video.srcObject = null;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new ScreenStreamer();
});