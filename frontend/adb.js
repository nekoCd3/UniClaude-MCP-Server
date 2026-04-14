const deviceSelect = document.getElementById("adbDeviceSelect");
const outputElement = document.getElementById("adbOutput");
const commandInput = document.getElementById("adbCommandInput");
const sendButton = document.getElementById("adbSendCommand");
const fsPath = document.getElementById("adbFsPath");
const refreshFsButton = document.getElementById("adbRefreshFs");
const fileTree = document.getElementById("adbFileTree");
const dropZone = document.getElementById("apkDropZone");
const apkStatus = document.getElementById("apkStatus");

let connectedUsbDevice = null;
let webUsbTerminal = null;

function formatOutput(text) {
  outputElement.textContent += `${text}\n`;
  outputElement.scrollTop = outputElement.scrollHeight;
}

function getDeviceOptions() {
  return window.__DEVICES__.filter((device) => device.type === "adb");
}

function renderDeviceOptions() {
  const devices = getDeviceOptions();
  deviceSelect.innerHTML = "";
  devices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.id;
    option.textContent = device.name;
    deviceSelect.appendChild(option);
  });
}

async function fetchFileTree() {
  const deviceId = deviceSelect.value;
  if (!deviceId) {
    return;
  }
  const path = fsPath.value.trim() || "/sdcard";
  fileTree.innerHTML = "";
  try {
    const response = await fetch(`/api/devices/${deviceId}/fs?path=${encodeURIComponent(path)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Unable to load file tree");
    }
    data.entries.forEach((entry) => {
      const row = document.createElement("div");
      row.className = `file-row ${entry.isDirectory ? "directory" : "file"}`;
      row.innerHTML = `<span class="file-name">${entry.name}</span><span>${entry.isDirectory ? "DIR" : `${entry.size} bytes`}</span>`;
      row.addEventListener("click", () => {
        if (entry.isDirectory) {
          fsPath.value = entry.path;
          fetchFileTree();
        }
      });
      fileTree.appendChild(row);
    });
  } catch (error) {
    apkStatus.textContent = error.message;
  }
}

async function sendAdbCommand() {
  const deviceId = deviceSelect.value;
  const command = commandInput.value.trim();
  if (!command || !deviceId) {
    return;
  }
  commandInput.value = "";

  formatOutput(`$ adb ${command}`);

  if (webUsbTerminal) {
    try {
      const text = await webUsbTerminal.shell(`${command}\n`);
      formatOutput(text);
      return;
    } catch (error) {
      formatOutput(`WebUSB shell failed: ${error.message}`);
    }
  }

  try {
    const response = await fetch(`/api/devices/${deviceId}/shell`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "Shell command failed");
    }
    formatOutput(body.output || "OK");
  } catch (error) {
    formatOutput(error.message);
  }
}

async function connectWebUsb() {
  try {
    connectedUsbDevice = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x18d1 }] });
    webUsbTerminal = new WebUSBAdbTerminal();
    await webUsbTerminal.connect();
    formatOutput("WebUSB ADB connected.");
  } catch (error) {
    formatOutput(error.message);
  }
}

async function installApk(file) {
  const deviceId = deviceSelect.value;
  const formData = new FormData();
  formData.append("apk", file);

  try {
    apkStatus.textContent = "Uploading APK...";
    const response = await fetch(`/api/devices/${deviceId}/install`, {
      method: "POST",
      body: formData
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "Install failed");
    }
    apkStatus.textContent = body.output;
  } catch (error) {
    apkStatus.textContent = error.message;
  }
}

dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  dropZone.classList.add("drag-over");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("drag-over");
});

dropZone.addEventListener("drop", async (event) => {
  event.preventDefault();
  dropZone.classList.remove("drag-over");
  const file = event.dataTransfer.files[0];
  if (!file || !file.name.toLowerCase().endsWith(".apk")) {
    apkStatus.textContent = "Please drop a valid APK file.";
    return;
  }
  await installApk(file);
});

sendButton.addEventListener("click", sendAdbCommand);
commandInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    sendAdbCommand();
  }
});
refreshFsButton.addEventListener("click", fetchFileTree);
deviceSelect.addEventListener("change", fetchFileTree);

renderDeviceOptions();
fetchFileTree();
