const canvas = document.getElementById("screenCanvas");
const status = document.getElementById("screenStatus");
const deviceSelect = document.getElementById("screenDeviceSelect");
const refreshButton = document.getElementById("screenRefresh");
const video = document.getElementById("screenSource");

function getAdbDevices() {
  return window.__DEVICES__.filter((device) => device.type === "adb");
}

function renderDeviceList() {
  const devices = getAdbDevices();
  devices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.id;
    option.textContent = device.name;
    deviceSelect.appendChild(option);
  });
}

function resizeCanvas() {
  canvas.width = window.innerWidth * 0.65;
  canvas.height = window.innerHeight * 0.6;
}

function drawFrame() {
  if (video.readyState >= 2) {
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  }
  requestAnimationFrame(drawFrame);
}

function buildStreamUrl(deviceId) {
  return `/api/screen/stream/${encodeURIComponent(deviceId)}`;
}

function connectStream() {
  const deviceId = deviceSelect.value;
  if (!deviceId) {
    status.textContent = "Select an ADB device first.";
    return;
  }

  video.src = buildStreamUrl(deviceId);
  video.play().then(() => {
    status.textContent = `Streaming ${deviceId}`;
  }).catch((error) => {
    status.textContent = `Stream error: ${error.message}`;
  });
}

refreshButton.addEventListener("click", connectStream);
window.addEventListener("resize", resizeCanvas);

renderDeviceList();
resizeCanvas();
connectStream();
drawFrame();
