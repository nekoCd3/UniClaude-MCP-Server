// Fastboot Flash functionality
class FastbootFlasher {
  constructor() {
    this.flashForm = document.getElementById('flashForm');
    this.partitionInput = document.getElementById('flashPartition');
    this.imageInput = document.getElementById('flashImage');
    this.statusElement = document.getElementById('fastbootFlashStatus');
    this.deviceSelect = document.getElementById('fastbootDeviceSelect');

    this.init();
  }

  init() {
    this.flashForm.addEventListener('submit', (e) => this.handleFlash(e));
  }

  async handleFlash(event) {
    event.preventDefault();

    const deviceId = this.deviceSelect.value;
    const partition = this.partitionInput.value.trim();
    const file = this.imageInput.files[0];

    if (!deviceId) {
      this.showStatus('Select a device first', 'error');
      return;
    }

    if (!partition) {
      this.showStatus('Enter a partition name', 'error');
      return;
    }

    if (!file) {
      this.showStatus('Select an image file', 'error');
      return;
    }

    this.showStatus('Uploading and flashing...', 'info');

    try {
      const formData = new FormData();
      formData.append('partition', partition);
      formData.append('image', file);

      const response = await fetch(`/api/fastboot/${deviceId}/flash`, {
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
      this.showStatus(`Flash failed: ${error.message}`, 'error');
    }
  }

  showStatus(message, type = 'info') {
    this.statusElement.textContent = message;
    this.statusElement.className = `status-line ${type}`;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new FastbootFlasher();
});