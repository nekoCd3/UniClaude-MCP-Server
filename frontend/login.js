async function initLogin() {
  const deviceSelect = document.getElementById("deviceSelect");
  const loginForm = document.getElementById("loginForm");
  const loginError = document.getElementById("loginError");

  try {
    const response = await fetch("/api/devices");
    const deviceList = await response.json();
    deviceList.forEach((device) => {
      const option = document.createElement("option");
      option.value = device.id;
      option.textContent = `${device.name} (${device.type})`;
      deviceSelect.appendChild(option);
    });
  } catch (error) {
    loginError.textContent = "Unable to load devices.";
    loginError.style.display = "block";
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginError.style.display = "none";
    const deviceId = deviceSelect.value;
    const token = document.getElementById("tokenInput").value.trim();

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId, token })
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Login failed");
      }
      window.location = "/dashboard";
    } catch (error) {
      loginError.textContent = error.message;
      loginError.style.display = "block";
    }
  });
}

initLogin();
