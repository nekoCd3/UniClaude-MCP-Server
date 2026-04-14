const deviceListElement = document.getElementById("deviceList");
const screenGrid = document.getElementById("screenGrid");
const fsPathInput = document.getElementById("fsPath");
const fileTree = document.getElementById("fileTree");
const fileStatus = document.getElementById("fileStatus");
const refreshDevicesButton = document.getElementById("refreshDevices");
const refreshTreeButton = document.getElementById("refreshTree");
const connectUsbButton = document.getElementById("connectUsb");
const logoutButton = document.getElementById("logoutButton");
const terminalOutput = document.getElementById("terminalOutput");
const terminalInput = document.getElementById("terminalInput");

let devices = [];
let selectedDeviceId = null;
let terminal = null;

async function fetchDevices() {
  const response = await fetch("/api/devices");
  if (!response.ok) {
    throw new Error("Unable to load devices");
  }
  devices = await response.json();
  selectedDeviceId = devices.length ? devices[0].id : null;
  renderDevices();
  renderScreenGrid();
  renderFileTree();
}

function renderDevices() {
  deviceListElement.innerHTML = "";
  devices.forEach((device) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = `device-card ${device.authorized ? "authorized" : "locked"}`;
    card.innerHTML = `<div><strong>${device.name}</strong><span>${device.type}</span></div><div><span>${device.authorized ? "Authorized" : "Locked"}</span></div>`;
    card.addEventListener("click", () => {
      selectedDeviceId = device.id;
      renderFileTree();
    });
    deviceListElement.appendChild(card);
  });
}

function createScreenTile(device) {
  const tile = document.createElement("div");
  tile.className = "screen-tile";

  const header = document.createElement("div");
  header.className = "tile-header";
  header.innerHTML = `<strong>${device.name}</strong><span class="tile-badge">${device.type}</span>`;

  const content = document.createElement("div");
  content.style.minHeight = "220px";

  if (!device.authorized) {
    content.className = "screen-status";
    content.textContent = "Authorize this device to stream the screen.";
  } else {
    const video = document.createElement("video");
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true;
    content.appendChild(video);
    startWebRTC(device.id, video).catch((error) => {
      content.className = "screen-status";
      content.textContent = `Stream failed: ${error.message}`;
    });
  }

  tile.appendChild(header);
  tile.appendChild(content);
  return tile;
}

async function renderScreenGrid() {
  screenGrid.innerHTML = "";
  devices.filter((device) => device.type === "adb").forEach((device) => {
    const tile = createScreenTile(device);
    screenGrid.appendChild(tile);
  });
}

async function startWebRTC(deviceId, videoElement) {
  const pc = new RTCPeerConnection();
  pc.addTransceiver("video", { direction: "recvonly" });
  pc.ontrack = (event) => {
    videoElement.srcObject = event.streams[0];
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  const response = await fetch(`/api/webrtc/offer/${deviceId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(pc.localDescription)
  });

  if (!response.ok) {
    const body = await response.json();
    throw new Error(body.error || "WebRTC offer failed");
  }

  const answer = await response.json();
  await pc.setRemoteDescription(answer);
}

async function renderFileTree() {
  fileTree.innerHTML = "";
  fileStatus.textContent = "";
  if (!selectedDeviceId) {
    fileStatus.textContent = "No device selected.";
    return;
  }

  const selected = devices.find((device) => device.id === selectedDeviceId);
  if (!selected || !selected.authorized) {
    fileStatus.textContent = "Authorize a device to browse its filesystem.";
    return;
  }

  const path = fsPathInput.value.trim() || "/sdcard";
  fileStatus.textContent = `Loading ${path}...`;

  try {
    const response = await fetch(`/api/devices/${selectedDeviceId}/fs?path=${encodeURIComponent(path)}`);
    if (!response.ok) {
      const body = await response.json();
      throw new Error(body.error || "Failed to read folder");
    }

    const body = await response.json();
    fileStatus.textContent = `Showing ${body.entries.length} entries in ${body.path}`;

    body.entries.sort((a, b) => {
      if (a.isDirectory === b.isDirectory) return a.name.localeCompare(b.name);
      return a.isDirectory ? -1 : 1;
    });

    body.entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = `file-row ${entry.isDirectory ? "directory" : "file"}`;
      row.innerHTML = `<span class="file-name">${entry.name}</span><span>${entry.isDirectory ? "Folder" : `${entry.size} bytes`}</span>`;
      row.addEventListener("click", () => {
        if (entry.isDirectory) {
          fsPathInput.value = entry.path;
          renderFileTree();
        }
      });
      fileTree.appendChild(row);
    });
  } catch (error) {
    fileStatus.textContent = `Error: ${error.message}`;
  }
}

refreshDevicesButton.addEventListener("click", fetchDevices);
refreshTreeButton.addEventListener("click", renderFileTree);

connectUsbButton.addEventListener("click", async () => {
  connectUsbButton.disabled = true;
  try {
    terminal = new WebUSBAdbTerminal();
    await terminal.connect();
    appendTerminalOutput("Connected to WebUSB ADB device. Ready for commands.\n");
  } catch (error) {
    appendTerminalOutput(`Connection failed: ${error.message}\n`);
  } finally {
    connectUsbButton.disabled = false;
  }
});

logoutButton.addEventListener("click", async () => {
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.reload();
});

terminalInput.addEventListener("keydown", async (event) => {
  if (event.key !== "Enter") return;
  const command = terminalInput.value.trim();
  if (!command) return;
  terminalInput.value = "";

  appendTerminalOutput(`$ ${command}\n`);
  if (!terminal) {
    appendTerminalOutput("WebUSB terminal is not connected.\n");
    return;
  }

  try {
    const output = await terminal.shell(command);
    appendTerminalOutput(`${output}\n`);
  } catch (error) {
    appendTerminalOutput(`Command failed: ${error.message}\n`);
  }
});

function appendTerminalOutput(text) {
  terminalOutput.textContent += text;
  terminalOutput.scrollTop = terminalOutput.scrollHeight;
}

fetchDevices().catch((error) => {
  fileStatus.textContent = `Unable to load devices: ${error.message}`;
});
