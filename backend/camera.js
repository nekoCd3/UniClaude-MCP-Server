const { spawn } = require("child_process");
const db = require("./db");

async function streamToResponse(deviceId, res) {
  const device = await db.getDevice(deviceId);
  if (!device) {
    res.status(404).send("Device not found");
    return;
  }
  if (device.type !== "camera") {
    res.status(400).send("Device is not a camera");
    return;
  }
  if (!device.endpoint) {
    res.status(400).send("Camera endpoint is not configured");
    return;
  }

  res.setHeader("Content-Type", "video/mp4");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const ffmpeg = spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-rtsp_transport",
    "tcp",
    "-i",
    device.endpoint,
    "-an",
    "-c:v",
    "copy",
    "-f",
    "mp4",
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    "pipe:1"
  ], { stdio: ["ignore", "pipe", "pipe"] });

  ffmpeg.stdout.pipe(res);

  ffmpeg.stderr.on("data", (chunk) => {
    console.warn(`ffmpeg stderr [camera-${deviceId}]:`, chunk.toString());
  });

  const cleanup = () => ffmpeg.kill("SIGKILL");
  res.on("close", cleanup);
  res.on("finish", cleanup);
}

module.exports = {
  streamToResponse
};
