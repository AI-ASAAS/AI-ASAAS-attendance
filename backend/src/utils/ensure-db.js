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
  if (!dbUrl.includes('5433') && !dbUrl.includes('localhost') && !dbUrl.includes('127.0.0.1')) {
    return;
  }

  const isOpen = await isPortOpen(5433);
  if (isOpen) return;

  const pgDataPath = path.resolve(__dirname, '../../../database/pgdata');
  if (!fs.existsSync(pgDataPath)) return;

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

  console.log(`[Database Auto-Start] Starting in-project PostgreSQL from: ${safeDataPath}`);
  const child = spawn(pgExe, ['-D', safeDataPath, '-p', '5433'], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true
  });
  child.unref();

  // Wait up to 5 seconds for PostgreSQL to become ready
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 350));
    if (await isPortOpen(5433)) {
      console.log('✅ In-project PostgreSQL is ready on port 5433');
      return;
    }
  }
}

module.exports = { ensureLocalDatabase };
