const cameraGrid = document.getElementById("cameraGrid");

function renderCameraTiles() {
  const devices = window.__DEVICES__.filter((device) => device.type === "camera");
  devices.forEach((device) => {
    const tile = document.createElement("div");
    tile.className = "screen-tile";
    tile.innerHTML = `
      <div class="tile-header">
        <strong>${device.name}</strong>
        <span class="tile-badge">Camera</span>
      </div>
      <video controls autoplay playsinline muted></video>
    `;
    const video = tile.querySelector("video");
    video.src = `/api/camera/stream/${encodeURIComponent(device.id)}`;
    cameraGrid.appendChild(tile);
  });
}

renderCameraTiles();
