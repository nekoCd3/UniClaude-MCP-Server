// ADB Terminal using WebADB and Chrome APIs
class AdbTerminal {
  constructor() {
    this.device = null;
    this.connection = null;
    this.outputElement = document.getElementById('adbOutput');
    this.commandInput = document.getElementById('adbCommandInput');
    this.sendButton = document.getElementById('adbSendCommand');
    this.deviceSelect = document.getElementById('adbDeviceSelect');
    this.connectButton = document.getElementById('connectWebUsb');

    this.init();
  }

  init() {
    this.populateDeviceSelect();
    this.connectButton.addEventListener('click', () => this.connectWebUSB());
    this.sendButton.addEventListener('click', () => this.sendCommand());
    this.commandInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.sendCommand();
    });
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

  async connectWebUSB() {
    try {
      // Use WebUSBAdbTerminal for ADB connection
      const adb = new WebUSBAdbTerminal();
      await adb.connect();
      this.device = adb;
      this.appendOutput('Connected to ADB device via WebUSB\n');
      this.connectButton.disabled = true;
      this.connectButton.textContent = 'Connected';
    } catch (error) {
      this.appendOutput(`Connection failed: ${error.message}\n`);
    }
  }

  async sendCommand() {
    const command = this.commandInput.value.trim();
    if (!command) return;

    this.appendOutput(`$ ${command}\n`);
    this.commandInput.value = '';

    if (!this.device) {
      this.appendOutput('No device connected. Use WebUSB to connect first.\n');
      return;
    }

    try {
      // Use WebUSBAdbTerminal for ADB protocol handling
      const output = await this.device.shell(command);
      this.appendOutput(`${output}\n`);
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
  new AdbTerminal();
});