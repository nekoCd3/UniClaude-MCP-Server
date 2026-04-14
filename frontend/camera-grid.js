// Camera grid using RTSP streams
class CameraGrid {
  constructor() {
    this.grid = document.getElementById('cameraGrid');
    this.init();
  }

  init() {
    this.renderCameras();
  }

  renderCameras() {
    this.grid.innerHTML = '';

    const cameras = window.__DEVICES__.filter(d => d.type === 'camera');

    if (cameras.length === 0) {
      this.grid.innerHTML = '<div class="status-line">No cameras configured</div>';
      return;
    }

    cameras.forEach(camera => {
      const cameraTile = document.createElement('div');
      cameraTile.className = 'camera-tile panel';

      const header = document.createElement('div');
      header.className = 'camera-header';
      header.innerHTML = `<h3>${camera.name}</h3><span class="status-indicator">●</span>`;

      const video = document.createElement('video');
      video.className = 'camera-video';
      video.autoplay = true;
      video.muted = true;
      video.playsInline = true;

      const status = document.createElement('div');
      status.className = 'camera-status';
      status.textContent = 'Connecting...';

      cameraTile.appendChild(header);
      cameraTile.appendChild(video);
      cameraTile.appendChild(status);

      this.grid.appendChild(cameraTile);
      this.connectCamera(camera, video, status);
    });
  }

  async connectCamera(camera, videoElement, statusElement) {
    try {
      // Use RTCMultiConnection for camera streaming
      const connection = new RTCMultiConnection();
      connection.socketURL = `ws://localhost:3000/ws/camera/${camera.id}`;

      connection.session = {
        audio: false,
        video: true
      };

      connection.onstream = (event) => {
        videoElement.srcObject = event.stream;
        statusElement.textContent = 'Live';
        statusElement.className = 'camera-status live';
      };

      connection.onstreamended = () => {
        statusElement.textContent = 'Disconnected';
        statusElement.className = 'camera-status error';
      };

      await connection.openOrJoin(camera.id);

    } catch (error) {
      statusElement.textContent = `Error: ${error.message}`;
      statusElement.className = 'camera-status error';
      console.error('Camera connection error:', error);
    }
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new CameraGrid();
});