// In-memory store — resets on Vercel cold start (fine for demo)
// alertQueue is pre-seeded with realistic sample data
let alertQueue = [
  { id: 1, user: 'User #482', bpm: 142, location: 'Kigali, RW',   time: Date.now() - 120000,   severity: 'critical', resolved: false },
  { id: 2, user: 'User #219', bpm: 38,  location: 'Huye, RW',     time: Date.now() - 660000,   severity: 'warning',  resolved: false },
  { id: 3, user: 'User #731', bpm: 155, location: 'Musanze, RW',  time: Date.now() - 1380000,  severity: 'critical', resolved: true  },
  { id: 4, user: 'User #102', bpm: 95,  location: 'Rubavu, RW',   time: Date.now() - 3600000,  severity: 'info',     resolved: true  },
];
let healthLogs = [];
let nextId = 5;

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action, id } = req.query;

  // ── POST: ingest a new health data reading ──
  if (req.method === 'POST') {
    const { userId, bpm, location } = req.body || {};

    if (!userId || bpm === undefined || bpm === null || bpm === '') {
      return res.status(400).json({ error: 'userId and bpm are required' });
    }

    const bpmNum = Number(bpm);
    if (isNaN(bpmNum)) {
      return res.status(400).json({ error: 'bpm must be a number' });
    }

    // Classify severity
    const severity =
      bpmNum < 40 || bpmNum > 150 ? 'critical' :
      bpmNum < 60 || bpmNum > 120 ? 'warning'  : 'info';

    const isAbnormal = severity !== 'info';

    const log = {
      id:       nextId++,
      user:     String(userId),
      bpm:      bpmNum,
      location: location || 'Unknown',
      time:     Date.now(),
      severity,
      resolved: false,
    };

    // Only push abnormal readings to the visible alert queue
    if (isAbnormal) alertQueue.unshift(log);
    healthLogs.push(log);

    // Keep memory under control
    if (healthLogs.length   > 500) healthLogs   = healthLogs.slice(-500);
    if (alertQueue.length   > 100) alertQueue   = alertQueue.slice(0, 100);

    return res.status(200).json({
      received:  true,
      alert:     isAbnormal,
      severity,
      log,
    });
  }

  // ── GET: resolve a specific alert ──
  if (action === 'resolve' && id) {
    const numId = parseInt(id, 10);
    alertQueue = alertQueue.map(a =>
      a.id === numId ? { ...a, resolved: true } : a
    );
    return res.status(200).json({ ok: true, resolvedId: numId });
  }

  // ── GET: dashboard summary ──
  const activeAlerts = alertQueue.filter(a => !a.resolved);

  // Simulated 24-hour average BPM chart data
  const chartData = Array.from({ length: 24 }, (_, i) => ({
    hour:    String(i).padStart(2, '0') + ':00',
    avgBpm:  Math.floor(65 + Math.sin(i * 0.42) * 11 + Math.random() * 7),
    alerts:  Math.floor(Math.random() * 3),
  }));

  return res.status(200).json({
    totalUsers:          1284,
    activeAlerts:        activeAlerts.length,
    hospitalsConnected:  12,
    emergenciesThisMonth: 7,
    uptime:              '99.98%',
    avgResponseTime:     '4.2 min',
    lastUpdated:         new Date().toISOString(),
    recentAlerts:        alertQueue.slice(0, 10),
    activeAlertsList:    activeAlerts,
    chartData,
  });
};
