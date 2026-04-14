const overviewGrid = document.getElementById("overviewGrid");
const summaryCount = document.getElementById("summaryCount");

async function loadDevices() {
  const response = await fetch("/api/devices");
  if (!response.ok) {
    throw new Error("Unable to load devices");
  }
  const devices = await response.json();
  renderOverview(devices);
}

function renderOverview(devices) {
  overviewGrid.innerHTML = "";
  devices.forEach((device) => {
    const tile = document.createElement("div");
    tile.className = "device-tile";
    tile.innerHTML = `
      <div class="tile-header">
        <strong>${device.name}</strong>
        <span class="tile-badge">${device.type}</span>
      </div>
      <div class="tile-body">
        <p>ID: ${device.id}</p>
        <p>Last seen: ${device.last_seen ? new Date(device.last_seen).toLocaleString() : "n/a"}</p>
      </div>
    `;
    overviewGrid.appendChild(tile);
  });
  summaryCount.textContent = `${devices.length} devices`;
}

loadDevices().catch((error) => {
  overviewGrid.innerHTML = `<div class="status-line">Unable to load devices: ${error.message}</div>`;
});
