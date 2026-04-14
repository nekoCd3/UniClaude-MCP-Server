const { spawn } = require("child_process");
const { RTCPeerConnection, nonstandard: { RTCVideoSource, RTCVideoFrame } } = require("wrtc");
const adb = require("./adb");
const db = require("./db");

const activePipelines = new Map();

function getScaledSize(width, height) {
  const maxDimension = 720;
  if (Math.max(width, height) <= maxDimension) {
    return { width, height };
  }
  const scale = maxDimension / Math.max(width, height);
  return {
    width: Math.max(16, Math.floor(width * scale)),
    height: Math.max(16, Math.floor(height * scale))
  };
}

function waitForIceGathering(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === "complete") {
      return resolve();
    }
    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) {
        resolve();
      }
    };
  });
}

function startScrcpyStream(deviceId, width, height, videoSource) {
  if (activePipelines.has(deviceId)) {
    return activePipelines.get(deviceId);
  }

  const pipeline = { ready: false, error: null };
  activePipelines.set(deviceId, pipeline);

  const scrcpy = spawn("scrcpy", [
    "--no-audio",
    "--max-size",
    "720",
    "--bit-rate",
    "4M",
    "--output-format=h264",
    "-"
  ]);

  const ffmpeg = spawn("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-fflags",
    "nobuffer",
    "-i",
    "pipe:0",
    "-f",
    "rawvideo",
    "-pix_fmt",
    "rgba",
    "-s",
    `${width}x${height}`,
    "pipe:1"
  ]);

  scrcpy.stdout.pipe(ffmpeg.stdin);

  let frameBuffer = Buffer.alloc(0);
  const frameSize = width * height * 4;

  ffmpeg.stdout.on("data", (chunk) => {
    frameBuffer = Buffer.concat([frameBuffer, chunk]);
    while (frameBuffer.length >= frameSize) {
      const frameData = frameBuffer.slice(0, frameSize);
      frameBuffer = frameBuffer.slice(frameSize);
      try {
        const frame = new RTCVideoFrame(new Uint8ClampedArray(frameData), {
          width,
          height,
          format: "RGBA"
        });
        videoSource.onFrame(frame);
      } catch (error) {
        // Ignore invalid frame delivery when data is malformed
      }
    }
  });

  function cleanup() {
    scrcpy.kill("SIGKILL");
    ffmpeg.kill("SIGKILL");
    activePipelines.delete(deviceId);
  }

  scrcpy.on("error", (error) => {
    pipeline.error = error;
    cleanup();
  });

  ffmpeg.on("error", (error) => {
    pipeline.error = error;
    cleanup();
  });

  scrcpy.stderr.on("data", (data) => {
    // Keep scrcpy logs for debugging if needed.
  });

  ffmpeg.stderr.on("data", (data) => {
    // Keep ffmpeg logs for debugging if needed.
  });

  scrcpy.on("exit", cleanup);
  ffmpeg.on("exit", cleanup);

  pipeline.ready = true;
  return pipeline;
}

async function createAnswer(deviceId, offer) {
  const device = await db.getDevice(deviceId);
  if (!device) {
    throw new Error("Device not found");
  }

  const screenSize = await adb.getScreenSize(deviceId);
  const scaled = getScaledSize(screenSize.width, screenSize.height);

  const videoSource = new RTCVideoSource();
  const pc = new RTCPeerConnection();

  const track = videoSource.createTrack();
  pc.addTrack(track);

  startScrcpyStream(deviceId, scaled.width, scaled.height, videoSource);

  await pc.setRemoteDescription(offer);
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIceGathering(pc);

  return pc.localDescription;
}

module.exports = {
  createAnswer
};
