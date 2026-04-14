// Fastboot Terminal using fastboot.js library
class FastbootTerminal {
  constructor() {
    this.deviceSelect = document.getElementById('fastbootDeviceSelect');
    this.commandInput = document.getElementById('fastbootCommandInput');
    this.sendButton = document.getElementById('fastbootSendCommand');
    this.outputElement = document.getElementById('fastbootOutput');

    this.fastboot = null;
    this.init();
  }

  init() {
    this.populateDeviceSelect();
    this.sendButton.addEventListener('click', () => this.sendCommand());
    this.commandInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendCommand();
    });

    // Initialize fastboot.js
    this.fastboot = new Fastboot();
  }

  populateDeviceSelect() {
    this.deviceSelect.innerHTML = '<option value="">Select device</option>';
    window.__DEVICES__.filter(d => d.type === 'fastboot').forEach(device => {
      const option = document.createElement('option');
      option.value = device.id;
      option.textContent = `${device.name} (${device.serial || 'disconnected'})`;
      this.deviceSelect.appendChild(option);
    });
  }

  async sendCommand() {
    const command = this.commandInput.value.trim();
    if (!command) return;

    const deviceId = this.deviceSelect.value;
    if (!deviceId) {
      this.appendOutput('Select a device first\n');
      return;
    }

    this.appendOutput(`$ fastboot ${command}\n`);
    this.commandInput.value = '';

    try {
      const response = await fetch(`/api/fastboot/${deviceId}/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      const result = await response.json();
      this.appendOutput(`${result.output}\n`);
    } catch (error) {
      this.appendOutput(`Command failed: ${error.message}\n`);
    }
  }

  appendOutput(text) {
    this.outputElement.textContent += text;
    this.outputElement.scrollTop = this.outputElement.scrollHeight;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new FastbootTerminal();
});