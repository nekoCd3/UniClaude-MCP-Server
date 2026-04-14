const { spawn } = require("child_process");
const db = require("./db");

function commandForDevice(deviceId, command) {
  const args = command.split(" ").filter(Boolean);
  return args;
}

function runFastbootCommand(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn("fastboot", args);
    let stdout = "";
    let stderr = "";

    proc.stdout.on("data", (chunk) => (stdout += chunk.toString()));
    proc.stderr.on("data", (chunk) => (stderr += chunk.toString()));

    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout.trim() || "OK");
      } else {
        reject(new Error(stderr.trim() || `fastboot failed (${code})`));
      }
    });

    proc.on("error", (error) => reject(error));
  });
}

async function runCommand(deviceId, command) {
  const device = await db.getDevice(deviceId);
  if (!device) {
    throw new Error("Device not found");
  }
  const args = commandForDevice(deviceId, command);
  if (!args.length) {
    throw new Error("No fastboot arguments provided");
  }
  return runFastbootCommand(args);
}

async function flash(deviceId, partition, imagePath) {
  const device = await db.getDevice(deviceId);
  if (!device) {
    throw new Error("Device not found");
  }
  const args = ["flash", partition, imagePath];
  return runFastbootCommand(args);
}

module.exports = {
  runCommand,
  flash
};
