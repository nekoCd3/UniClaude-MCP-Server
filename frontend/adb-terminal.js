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
      if (!navigator.usb) {
        throw new Error('WebUSB not supported');
      }

      const device = await navigator.usb.requestDevice({
        filters: [{ classCode: 255, subclassCode: 66, protocolCode: 1 }]
      });

      await device.open();
      await device.selectConfiguration(1);

      const interface = device.configuration.interfaces.find(iface =>
        iface.claimed === false && iface.alternates.some(alt =>
          alt.interfaceClass === 255 && alt.interfaceSubclass === 66 && alt.interfaceProtocol === 1
        )
      );

      if (!interface) {
        throw new Error('No ADB interface found');
      }

      await device.claimInterface(interface.interfaceNumber);

      const inEndpoint = interface.alternates[0].endpoints.find(ep => ep.direction === 'in');
      const outEndpoint = interface.alternates[0].endpoints.find(ep => ep.direction === 'out');

      this.device = device;
      this.inEndpoint = inEndpoint;
      this.outEndpoint = outEndpoint;

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
      // Use ya-webadb for ADB protocol handling
      const adb = new YaWebADB(this.device);
      const output = await adb.shell(command);
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