-- ASAS Attendance System - SQLite Schema (Crash-safe WAL compatible)
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  latitude REAL NOT NULL CHECK(latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK(longitude BETWEEN -180 AND 180),
  entry_radius INTEGER NOT NULL CHECK(entry_radius BETWEEN 10 AND 1000),
  exit_radius INTEGER NOT NULL CHECK(exit_radius > entry_radius AND exit_radius <= 2000),
  max_accuracy INTEGER NOT NULL CHECK(max_accuracy BETWEEN 1 AND 500),
  exit_samples INTEGER NOT NULL DEFAULT 3 CHECK(exit_samples BETWEEN 2 AND 10),
  exit_delay_seconds INTEGER NOT NULL DEFAULT 120 CHECK(exit_delay_seconds BETWEEN 30 AND 600),
  active INTEGER NOT NULL DEFAULT 1,
  location_revision INTEGER NOT NULL DEFAULT 1,
  qr_revision INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS shifts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  work_days TEXT NOT NULL DEFAULT '[0,1,2,3,4]',
  grace_minutes INTEGER NOT NULL DEFAULT 15 CHECK(grace_minutes BETWEEN 0 AND 120),
  close_policy TEXT NOT NULL DEFAULT 'actual_exit' CHECK(close_policy IN ('actual_exit','scheduled')),
  deduct_away INTEGER NOT NULL DEFAULT 0,
  CHECK(start_time <> end_time)
);

CREATE TABLE IF NOT EXISTS departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('super_admin','hr_admin','branch_manager','viewer','employee')),
  branch_id INTEGER REFERENCES branches(id),
  shift_id INTEGER REFERENCES shifts(id),
  department_id INTEGER REFERENCES departments(id),
  email TEXT,
  phone TEXT,
  bound_device_id TEXT,
  bound_device_name TEXT,
  device_bound_at TEXT,
  permissions TEXT NOT NULL DEFAULT '[]',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  avatar TEXT,
  is_remote INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_unique_idx ON accounts (LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_bound_device_idx ON accounts (bound_device_id) WHERE bound_device_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
CREATE INDEX IF NOT EXISTS auth_expiry ON auth_sessions(expires_at);

CREATE TABLE IF NOT EXISTS duty_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES accounts(id),
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  shift_id INTEGER NOT NULL REFERENCES shifts(id),
  shift_start TEXT NOT NULL,
  shift_end TEXT NOT NULL,
  first_in TEXT NOT NULL,
  last_out TEXT,
  state TEXT NOT NULL CHECK(state IN ('inside','outside','closed')),
  exit_reason TEXT,
  close_policy TEXT NOT NULL CHECK(close_policy IN ('actual_exit','scheduled','manual')),
  deduct_away INTEGER NOT NULL DEFAULT 0,
  away_started TEXT,
  away_seconds INTEGER NOT NULL DEFAULT 0,
  late_minutes INTEGER NOT NULL DEFAULT 0,
  gps_state TEXT NOT NULL DEFAULT 'inside',
  last_seen TEXT,
  exit_candidate TEXT,
  is_remote INTEGER NOT NULL DEFAULT 0,
  UNIQUE(employee_id, shift_start),
  CHECK(shift_end > shift_start)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_inside_record ON duty_records(employee_id) WHERE state='inside';
CREATE INDEX IF NOT EXISTS duty_employee_time ON duty_records(employee_id, shift_start DESC);

CREATE TABLE IF NOT EXISTS attendance_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_id INTEGER REFERENCES duty_records(id),
  employee_id INTEGER NOT NULL REFERENCES accounts(id),
  kind TEXT NOT NULL,
  captured_at TEXT,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  details TEXT NOT NULL DEFAULT '{}',
  request_id TEXT,
  UNIQUE(employee_id, request_id)
);
CREATE INDEX IF NOT EXISTS event_employee_time ON attendance_events(employee_id, received_at DESC);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_id INTEGER REFERENCES accounts(id),
  action TEXT NOT NULL,
  target TEXT,
  reason TEXT,
  details TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES accounts(id),
  from_date TEXT NOT NULL,
  to_date TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
  reviewed_by INTEGER REFERENCES accounts(id),
  comment TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK(to_date >= from_date)
);

CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  sender_id INTEGER REFERENCES accounts(id),
  sender_name TEXT,
  send_email INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  active INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS assistant_user_policies (
  account_id INTEGER PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  enabled INTEGER NOT NULL DEFAULT 1,
  daily_limit INTEGER,
  allow_hours_info INTEGER NOT NULL DEFAULT 1,
  allow_leave_info INTEGER NOT NULL DEFAULT 1,
  allow_team_data INTEGER NOT NULL DEFAULT 0,
  allow_general_help INTEGER NOT NULL DEFAULT 1,
  strict_topic_only INTEGER NOT NULL DEFAULT 1,
  blocked_keywords TEXT NOT NULL DEFAULT '',
  custom_note TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS assistant_usage_daily (
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  questions_count INTEGER NOT NULL DEFAULT 0,
  blocked_count INTEGER NOT NULL DEFAULT 0,
  last_asked_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (account_id, day)
);
