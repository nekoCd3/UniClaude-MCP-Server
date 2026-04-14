// ADB APK Install with drag & drop
class AdbInstaller {
  constructor() {
    this.dropZone = document.getElementById('apkDropZone');
    this.statusElement = document.getElementById('apkStatus');
    this.deviceSelect = document.getElementById('adbDeviceSelect');

    this.init();
  }

  init() {
    this.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropZone.classList.add('drag-over');
    });

    this.dropZone.addEventListener('dragleave', () => {
      this.dropZone.classList.remove('drag-over');
    });

    this.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropZone.classList.remove('drag-over');
      this.handleFileDrop(e.dataTransfer.files);
    });

    this.dropZone.addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.apk';
      input.addEventListener('change', (e) => {
        this.handleFileDrop(e.target.files);
      });
      input.click();
    });
  }

  async handleFileDrop(files) {
    const file = files[0];
    if (!file || !file.name.endsWith('.apk')) {
      this.showStatus('Please select an APK file', 'error');
      return;
    }

    const deviceId = this.deviceSelect.value;
    if (!deviceId) {
      this.showStatus('Select a device first', 'error');
      return;
    }

    this.showStatus('Uploading APK...', 'info');

    try {
      const formData = new FormData();
      formData.append('apk', file);

      const response = await fetch(`/api/devices/${deviceId}/install`, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      this.showStatus(result.output, 'success');
    } catch (error) {
      this.showStatus(`Install failed: ${error.message}`, 'error');
    }
  }

  showStatus(message, type = 'info') {
    this.statusElement.textContent = message;
    this.statusElement.className = `status-line ${type}`;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AdbInstaller();
});