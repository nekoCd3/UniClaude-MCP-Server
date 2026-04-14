const ADB_COMMANDS = {
  CNXN: 0x4e584e43,
  AUTH: 0x48545541,
  OPEN: 0x4e45504f,
  OKAY: 0x59414b4f,
  CLSE: 0x45534c43,
  WRTE: 0x45545257
};

const ADB_AUTH_TYPES = {
  TOKEN: 1,
  SIGNATURE: 2,
  RSAPUBLICKEY: 3
};

function checksum(buffer) {
  return Array.from(new Uint8Array(buffer)).reduce((sum, value) => (sum + value) >>> 0, 0);
}

function adbHeader(command, arg0, arg1, dataLength, dataChecksum) {
  const buffer = new ArrayBuffer(24);
  const view = new DataView(buffer);
  view.setUint32(0, command, true);
  view.setUint32(4, arg0, true);
  view.setUint32(8, arg1, true);
  view.setUint32(12, dataLength, true);
  view.setUint32(16, dataChecksum, true);
  view.setUint32(20, command ^ 0xffffffff, true);
  return buffer;
}

function stringToBytes(value) {
  return new TextEncoder().encode(value);
}

function findAdbInterface(device) {
  for (const iface of device.configuration.interfaces) {
    for (const alternate of iface.alternates) {
      const bulkEndpoints = alternate.endpoints.filter((endpoint) => endpoint.type === "bulk");
      if (bulkEndpoints.length >= 2) {
        const outEndpoint = bulkEndpoints.find((endpoint) => endpoint.direction === "out");
        const inEndpoint = bulkEndpoints.find((endpoint) => endpoint.direction === "in");
        if (outEndpoint && inEndpoint) {
          return {
            interfaceNumber: iface.interfaceNumber,
            outEndpoint: outEndpoint.endpointNumber,
            inEndpoint: inEndpoint.endpointNumber
          };
        }
      }
    }
  }
  return null;
}

class WebUSBAdbTerminal {
  constructor() {
    this.device = null;
    this.inEndpoint = null;
    this.outEndpoint = null;
    this.localId = 1;
    this.remoteId = 0;
    this.outputBuffer = "";
  }

  async connect() {
    if (!navigator.usb) {
      throw new Error("WebUSB is not supported in this browser.");
    }

    this.device = await navigator.usb.requestDevice({ filters: [{ classCode: 255 }] });
    await this.device.open();
    if (!this.device.configuration) {
      await this.device.selectConfiguration(1);
    }

    const adbInterface = findAdbInterface(this.device);
    if (!adbInterface) {
      throw new Error("No ADB-compatible USB interface found.");
    }

    await this.device.claimInterface(adbInterface.interfaceNumber);
    this.outEndpoint = adbInterface.outEndpoint;
    this.inEndpoint = adbInterface.inEndpoint;

    await this.sendConnect();
    const reply = await this.readPacket();
    if (reply.command === ADB_COMMANDS.AUTH) {
      if (reply.arg0 === ADB_AUTH_TYPES.TOKEN) {
        throw new Error("ADB authorization is required on the device.");
      }
    }
    if (reply.command !== ADB_COMMANDS.CNXN) {
      throw new Error("Unable to establish ADB connection.");
    }

    await this.sendOpen("shell:");
    const openResponse = await this.readPacket();
    if (openResponse.command !== ADB_COMMANDS.OKAY) {
      throw new Error("Unable to open shell channel.");
    }
    this.remoteId = openResponse.arg0;
    this.runReader();
  }

  async currentOutput() {
    return this.outputBuffer;
  }

  async sendConnect() {
    const payload = stringToBytes("host::webusb\0");
    const header = adbHeader(
      ADB_COMMANDS.CNXN,
      0x01000000,
      4096,
      payload.byteLength,
      checksum(payload)
    );
    await this.device.transferOut(this.outEndpoint, header);
    await this.device.transferOut(this.outEndpoint, payload);
  }

  async sendOpen(destination) {
    const payload = stringToBytes(destination + "\0");
    const header = adbHeader(
      ADB_COMMANDS.OPEN,
      this.localId,
      0,
      payload.byteLength,
      checksum(payload)
    );
    await this.device.transferOut(this.outEndpoint, header);
    await this.device.transferOut(this.outEndpoint, payload);
  }

  async sendOkay() {
    const header = adbHeader(
      ADB_COMMANDS.OKAY,
      this.remoteId,
      this.localId,
      0,
      0
    );
    await this.device.transferOut(this.outEndpoint, header);
  }

  async sendWrite(data) {
    const payload = stringToBytes(data);
    const header = adbHeader(
      ADB_COMMANDS.WRTE,
      this.localId,
      this.remoteId,
      payload.byteLength,
      checksum(payload)
    );
    await this.device.transferOut(this.outEndpoint, header);
    await this.device.transferOut(this.outEndpoint, payload);
  }

  async sendClse() {
    const header = adbHeader(
      ADB_COMMANDS.CLSE,
      this.localId,
      this.remoteId,
      0,
      0
    );
    await this.device.transferOut(this.outEndpoint, header);
  }

  async readPacket() {
    const headerTransfer = await this.device.transferIn(this.inEndpoint, 24);
    const headerView = new DataView(headerTransfer.data.buffer);
    const command = headerView.getUint32(0, true);
    const arg0 = headerView.getUint32(4, true);
    const arg1 = headerView.getUint32(8, true);
    const dataLength = headerView.getUint32(12, true);
    const dataChecksum = headerView.getUint32(16, true);

    let data = new Uint8Array(0);
    if (dataLength > 0) {
      const dataTransfer = await this.device.transferIn(this.inEndpoint, dataLength);
      data = new Uint8Array(dataTransfer.data.buffer);
      const actualChecksum = checksum(data);
      if (actualChecksum !== dataChecksum) {
        throw new Error("ADB data checksum mismatch.");
      }
    }

    return { command, arg0, arg1, dataLength, data };
  }

  async runReader() {
    while (this.device && this.device.opened) {
      try {
        const packet = await this.readPacket();
        if (packet.command === ADB_COMMANDS.WRTE) {
          const text = new TextDecoder().decode(packet.data);
          this.outputBuffer += text;
          await this.sendOkay();
        } else if (packet.command === ADB_COMMANDS.CLSE) {
          await this.sendClse();
          break;
        } else if (packet.command === ADB_COMMANDS.OKAY) {
          continue;
        }
      } catch (error) {
        break;
      }
    }
  }

  async shell(command) {
    if (!this.device || !this.device.opened) {
      throw new Error("ADB connection is not open.");
    }
    await this.sendWrite(`${command}\n`);
    await new Promise((resolve) => setTimeout(resolve, 250));
    return this.outputBuffer;
  }
}
