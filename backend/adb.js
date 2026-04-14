const adb = require("adbkit");
const db = require("./db");

const client = adb.createClient();

async function resolveSerial(deviceId) {
  const device = await db.getDevice(deviceId);
  if (!device) {
    throw new Error("Unknown device");
  }

  if (device.serial) {
    return device.serial;
  }

  const connected = await client.listDevices();
  if (!connected.length) {
    throw new Error("No ADB devices connected");
  }

  const serial = connected[0].id;
  await db.setDeviceSerial(deviceId, serial);
  return serial;
}

async function shell(deviceId, command) {
  const serial = await resolveSerial(deviceId);
  const stream = await client.shell(serial, command);
  const output = await adb.util.readAll(stream);
  await db.updateDeviceLastSeen(deviceId);
  return output.toString("utf8").replace(/\r/g, "").trim();
}

async function installApk(deviceId, filePath) {
  const serial = await resolveSerial(deviceId);
  await client.install(serial, filePath);
  await db.updateDeviceLastSeen(deviceId);
  return "APK installed successfully";
}

async function listFiles(deviceId, pathName) {
  const serial = await resolveSerial(deviceId);
  const entries = await client.readdir(serial, pathName || "/sdcard");
  await db.updateDeviceLastSeen(deviceId);
  return entries.map((entry) => ({
    name: entry.name,
    path: `${pathName.replace(/\/$/, "")}/${entry.name}`,
    isDirectory: entry.isDirectory(),
    size: entry.size || 0,
    mode: entry.mode.toString(8),
    modified: entry.mtime
  }));
}

async function getScreenSize(deviceId) {
  const output = await shell(deviceId, "wm size");
  const match = output.match(/Physical size:\s*([0-9]+)x([0-9]+)/);
  if (match) {
    return { width: Number(match[1]), height: Number(match[2]) };
  }
  return { width: 720, height: 1280 };
}

async function handleWebSocket(deviceId, ws) {
  const device = await db.getDevice(deviceId);
  if (!device) {
    ws.close(1008, "Device not found");
    return;
  }

  try {
    const serial = await resolveSerial(deviceId);
    const adbStream = await client.shell(serial, "sh");

    adbStream.on("data", (chunk) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(chunk);
      }
    });

    ws.on("message", (message) => {
      adbStream.write(message);
    });

    ws.on("close", () => {
      adbStream.end();
    });

    ws.on("error", () => {
      adbStream.end();
    });

    adbStream.on("error", () => {
      ws.close();
    });

  } catch (error) {
    ws.close(1011, error.message);
  }
}

module.exports = {
  resolveSerial,
  shell,
  installApk,
  listFiles,
  getScreenSize,
  handleWebSocket
};
