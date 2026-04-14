const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "nexus.sqlite");
const db = new sqlite3.Database(dbPath);

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

async function init() {
  await run(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT,
      type TEXT,
      serial TEXT,
      endpoint TEXT,
      created_at INTEGER,
      last_seen INTEGER
    )
  `);

  const existing = await get("SELECT COUNT(*) AS count FROM devices");
  if (!existing || !existing.count) {
    const now = Date.now();
    const sampleDevices = [
      {
        id: "adb1",
        name: "Android Phone",
        type: "adb",
        serial: "",
        endpoint: "",
        created_at: now,
        last_seen: now
      },
      {
        id: "fb1",
        name: "Fastboot Phone",
        type: "fastboot",
        serial: "",
        endpoint: "",
        created_at: now,
        last_seen: now
      },
      {
        id: "cam1",
        name: "Security Camera",
        type: "camera",
        serial: "",
        endpoint: "rtsp://127.0.0.1:8554/live",
        created_at: now,
        last_seen: now
      }
    ];

    for (const device of sampleDevices) {
      await run(
        "INSERT INTO devices (id, name, type, serial, endpoint, created_at, last_seen) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [device.id, device.name, device.type, device.serial, device.endpoint, device.created_at, device.last_seen]
      );
    }
  }
}

async function getDevices() {
  return all("SELECT * FROM devices ORDER BY created_at DESC");
}

async function getDevice(id) {
  return get("SELECT * FROM devices WHERE id = ?", [id]);
}

async function setDeviceSerial(id, serial) {
  return run("UPDATE devices SET serial = ?, last_seen = ? WHERE id = ?", [serial, Date.now(), id]);
}

async function updateDeviceLastSeen(id) {
  return run("UPDATE devices SET last_seen = ? WHERE id = ?", [Date.now(), id]);
}

module.exports = {
  init,
  getDevices,
  getDevice,
  setDeviceSerial,
  updateDeviceLastSeen
};
