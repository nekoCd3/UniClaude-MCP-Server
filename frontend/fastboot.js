const deviceSelect = document.getElementById("fastbootDeviceSelect");
const outputElement = document.getElementById("fastbootOutput");
const commandInput = document.getElementById("fastbootCommandInput");
const sendButton = document.getElementById("fastbootSendCommand");
const flashForm = document.getElementById("flashForm");
const flashStatus = document.getElementById("fastbootFlashStatus");

function appendOutput(line) {
  outputElement.textContent += `${line}\n`;
  outputElement.scrollTop = outputElement.scrollHeight;
}

function renderFastbootOptions() {
  const devices = window.__DEVICES__.filter((device) => device.type === "fastboot");
  deviceSelect.innerHTML = "";
  devices.forEach((device) => {
    const option = document.createElement("option");
    option.value = device.id;
    option.textContent = device.name;
    deviceSelect.appendChild(option);
  });
}

async function sendFastbootCommand() {
  const deviceId = deviceSelect.value;
  const command = commandInput.value.trim();
  if (!command || !deviceId) return;
  appendOutput(`fastboot ${command}`);

  try {
    const response = await fetch(`/api/fastboot/${deviceId}/command`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command })
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "Fastboot failed");
    }
    appendOutput(body.output);
  } catch (error) {
    appendOutput(`Error: ${error.message}`);
  }
}

flashForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const deviceId = deviceSelect.value;
  const partition = document.getElementById("flashPartition").value.trim() || "system";
  const imageFile = document.getElementById("flashImage").files[0];
  if (!deviceId || !imageFile) {
    flashStatus.textContent = "Specify a device and an image file.";
    return;
  }

  const formData = new FormData();
  formData.append("image", imageFile);
  formData.append("partition", partition);

  flashStatus.textContent = "Uploading image...";
  try {
    const response = await fetch(`/api/fastboot/${deviceId}/flash`, {
      method: "POST",
      body: formData
    });
    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.error || "Flash failed");
    }
    flashStatus.textContent = body.output;
  } catch (error) {
    flashStatus.textContent = error.message;
  }
});

sendButton.addEventListener("click", sendFastbootCommand);

renderFastbootOptions();
