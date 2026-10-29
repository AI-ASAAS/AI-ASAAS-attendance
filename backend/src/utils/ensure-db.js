const net = require('net');
const path = require('path');
const fs = require('fs');
const { spawn, execSync } = require('child_process');

function isPortOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(800);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function ensureLocalDatabase() {
  const dbUrl = process.env.DATABASE_URL || '';
  const portMatch = dbUrl.match(/:(\d+)\//);
  const targetPort = portMatch ? parseInt(portMatch[1], 10) : 6543;

  const isOpen = await isPortOpen(targetPort);
  if (isOpen) return;

  const candidatePaths = [
    'C:\\Users\\Anoos.alaghbari\\asas_pgdata',
    path.resolve(__dirname, '../../../database/pgdata')
  ];

  let pgDataPath = candidatePaths.find(p => fs.existsSync(p));
  if (!pgDataPath) return;

  // Clean stale lock file if postgres was abruptly stopped
  const pidFile = path.join(pgDataPath, 'postmaster.pid');
  if (fs.existsSync(pidFile)) {
    try { fs.unlinkSync(pidFile); } catch (e) {}
  }

  let pgExe = 'C:\\Program Files\\PostgreSQL\\18\\bin\\postgres.exe';
  if (!fs.existsSync(pgExe)) pgExe = 'C:\\Program Files\\PostgreSQL\\17\\bin\\postgres.exe';
  if (!fs.existsSync(pgExe)) pgExe = 'C:\\Program Files\\PostgreSQL\\16\\bin\\postgres.exe';
  if (!fs.existsSync(pgExe)) return;

  // On Windows, resolve 8.3 short path to avoid non-ASCII path parsing issues
  let safeDataPath = pgDataPath;
  try {
    const cmd = `for %I in ("${pgDataPath}") do @echo %~fsI`;
    const shortPath = execSync(cmd, { shell: 'cmd.exe', windowsHide: true }).toString().trim();
    if (shortPath) safeDataPath = shortPath;
  } catch (e) {}

  console.log(`[Database Auto-Start] Starting PostgreSQL on port ${targetPort} from: ${safeDataPath}`);
  const child = spawn(pgExe, ['-D', safeDataPath, '-p', String(targetPort)], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();

  // Wait up to 10 seconds for PostgreSQL to become ready
  for (let i = 0; i < 25; i++) {
    await new Promise((r) => setTimeout(r, 400));
    if (await isPortOpen(targetPort)) {
      console.log(`✅ PostgreSQL is ready on port ${targetPort}`);
      return;
    }
  }
}

module.exports = { ensureLocalDatabase };
