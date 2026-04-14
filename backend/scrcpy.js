const { spawn } = require("child_process");
const db = require("./db");

function createScrcpyProcess() {
  return spawn("scrcpy", [
    "--no-audio",
    "--max-size",
    "720",
    "--bit-rate",
    "4M",
    "--output-format=h264",
    "-"
  ], { stdio: ["ignore", "pipe", "pipe"] });
}

async function streamToSocket(deviceId, ws) {
  const device = await db.getDevice(deviceId);
  if (!device) {
    ws.close(1008, "Device not found");
    return;
  }

  const proc = createScrcpyProcess();

  proc.stdout.on("data", (chunk) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(chunk);
    }
  });

  proc.stderr.on("data", (chunk) => {
    console.warn(`scrcpy stderr [${deviceId}]:`, chunk.toString());
  });

  ws.on("close", () => {
    proc.kill("SIGKILL");
  });

  ws.on("error", () => {
    proc.kill("SIGKILL");
  });
}

async function streamToResponse(deviceId, res) {
  const device = await db.getDevice(deviceId);
  if (!device) {
    res.status(404).send("Device not found");
    return;
  }

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const scrcpy = createScrcpyProcess();
  const ffmpeg = spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-fflags",
    "nobuffer",
    "-i",
    "pipe:0",
    "-c:v",
    "copy",
    "-f",
    "mp4",
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    "pipe:1"
  ], { stdio: ["pipe", "pipe", "pipe"] });

  scrcpy.stdout.pipe(ffmpeg.stdin);
  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on("data", (chunk) => {
    console.warn(`ffmpeg stderr [scrcpy-${deviceId}]:`, chunk.toString());
  });

  const cleanup = () => {
    scrcpy.kill("SIGKILL");
    ffmpeg.kill("SIGKILL");
  };

  res.on("close", cleanup);
  res.on("finish", cleanup);
}

module.exports = {
  streamToSocket,
  streamToResponse
};
