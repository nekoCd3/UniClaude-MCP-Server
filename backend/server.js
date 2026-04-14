const fs = require("fs");
const path = require("path");
const http = require("http");
const express = require("express");
const multer = require("multer");
const WebSocket = require("ws");

const db = require("./db");
const adb = require("./adb");
const fastboot = require("./fastboot");
const scrcpy = require("./scrcpy");
const camera = require("./camera");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 3000;

const upload = multer({ dest: path.join(__dirname, "../uploads") });
fs.mkdirSync(path.join(__dirname, "../uploads"), { recursive: true });

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "../views"));

app.use(express.static(path.join(__dirname, "../frontend")));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", async (req, res) => {
  const devices = await db.getDevices();
  return res.render("dashboard", { devices });
});

app.get("/adb", async (req, res) => {
  const devices = await db.getDevices();
  return res.render("adb", { devices });
});

app.get("/fastboot", async (req, res) => {
  const devices = await db.getDevices();
  return res.render("fastboot", { devices });
});

app.get("/screen", async (req, res) => {
  const devices = await db.getDevices();
  return res.render("screen", { devices });
});

app.get("/camera", async (req, res) => {
  const devices = await db.getDevices();
  return res.render("camera", { devices });
});

app.get("/api/devices", async (req, res) => {
  const devices = await db.getDevices();
  return res.json(devices);
});

app.post("/api/devices/:id/shell", async (req, res) => {
  const command = req.body.command;
  if (!command) {
    return res.status(400).json({ error: "Command is required" });
  }
  try {
    const output = await adb.shell(req.params.id, command);
    return res.json({ output });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/devices/:id/install", upload.single("apk"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "APK file is required" });
  }
  try {
    const output = await adb.installApk(req.params.id, req.file.path);
    return res.json({ output });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/devices/:id/fs", async (req, res) => {
  const devicePath = req.query.path || "/sdcard";
  try {
    const entries = await adb.listFiles(req.params.id, devicePath);
    return res.json({ path: devicePath, entries });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/fastboot/:id/command", async (req, res) => {
  const command = req.body.command;
  if (!command) {
    return res.status(400).json({ error: "fastboot command is required" });
  }
  try {
    const output = await fastboot.runCommand(req.params.id, command);
    return res.json({ output });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.post("/api/fastboot/:id/flash", upload.single("image"), async (req, res) => {
  const partition = req.body.partition || "system";
  if (!req.file) {
    return res.status(400).json({ error: "Image file is required" });
  }
  try {
    const output = await fastboot.flash(req.params.id, partition, req.file.path);
    return res.json({ output });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.get("/api/screen/stream/:id", async (req, res) => {
  try {
    await scrcpy.streamToResponse(req.params.id, res);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

app.get("/api/camera/stream/:id", async (req, res) => {
  try {
    await camera.streamToResponse(req.params.id, res);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

wss.on("connection", (ws, req) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname.startsWith("/ws/screen/")) {
    const deviceId = url.pathname.replace("/ws/screen/", "");
    scrcpy.streamToSocket(deviceId, ws);
    return;
  }
  ws.close(1000, "Unknown socket route");
});

(async () => {
  await db.init();
  server.listen(PORT, () => console.log(`Nexus V4 running on http://localhost:${PORT}`));
})();
