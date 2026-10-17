-- Fresh ASAS installation only. The upstream demo schema is not used.
CREATE TABLE IF NOT EXISTS branches (
 id SERIAL PRIMARY KEY, name TEXT NOT NULL, latitude DOUBLE PRECISION NOT NULL CHECK(latitude BETWEEN -90 AND 90),
 longitude DOUBLE PRECISION NOT NULL CHECK(longitude BETWEEN -180 AND 180),
 entry_radius INTEGER NOT NULL CHECK(entry_radius BETWEEN 10 AND 1000),
 exit_radius INTEGER NOT NULL CHECK(exit_radius>entry_radius AND exit_radius<=2000),
 max_accuracy INTEGER NOT NULL CHECK(max_accuracy BETWEEN 1 AND 100),
 exit_samples INTEGER NOT NULL DEFAULT 3 CHECK(exit_samples BETWEEN 2 AND 10),
 exit_delay_seconds INTEGER NOT NULL DEFAULT 120 CHECK(exit_delay_seconds BETWEEN 30 AND 600),
 active BOOLEAN NOT NULL DEFAULT TRUE, location_revision INTEGER NOT NULL DEFAULT 1, qr_revision INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS shifts (
 id SERIAL PRIMARY KEY, name TEXT NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL,
 work_days INTEGER[] NOT NULL DEFAULT '{0,1,2,3,4}', grace_minutes INTEGER NOT NULL DEFAULT 15 CHECK(grace_minutes BETWEEN 0 AND 120),
 close_policy TEXT NOT NULL DEFAULT 'actual_exit' CHECK(close_policy IN ('actual_exit','scheduled')),
 deduct_away BOOLEAN NOT NULL DEFAULT FALSE, CHECK(start_time<>end_time)
);
CREATE TABLE IF NOT EXISTS departments (id SERIAL PRIMARY KEY,name TEXT NOT NULL UNIQUE);
CREATE TABLE IF NOT EXISTS accounts (
 id SERIAL PRIMARY KEY, identifier TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('super_admin','hr_admin','branch_manager','viewer','employee')),
 branch_id INTEGER REFERENCES branches(id), shift_id INTEGER REFERENCES shifts(id), department_id INTEGER REFERENCES departments(id),
 email TEXT, phone TEXT, bound_device_id TEXT, bound_device_name TEXT, device_bound_at TIMESTAMPTZ,
 permissions TEXT[] NOT NULL DEFAULT '{}', active BOOLEAN NOT NULL DEFAULT TRUE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_email_unique_idx ON accounts (LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_bound_device_idx ON accounts (bound_device_id) WHERE bound_device_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS auth_sessions (
 token_hash TEXT PRIMARY KEY, account_id INTEGER NOT NULL REFERENCES accounts(id), expires_at TIMESTAMPTZ NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS duty_records (
 id BIGSERIAL PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES accounts(id), branch_id INTEGER NOT NULL REFERENCES branches(id),
 shift_id INTEGER NOT NULL REFERENCES shifts(id), shift_start TIMESTAMPTZ NOT NULL, shift_end TIMESTAMPTZ NOT NULL,
 first_in TIMESTAMPTZ NOT NULL, last_out TIMESTAMPTZ,
 state TEXT NOT NULL CHECK(state IN ('inside','outside','closed')), exit_reason TEXT,
 close_policy TEXT NOT NULL CHECK(close_policy IN ('actual_exit','scheduled')), deduct_away BOOLEAN NOT NULL,
 away_started TIMESTAMPTZ, away_seconds INTEGER NOT NULL DEFAULT 0, late_minutes INTEGER NOT NULL DEFAULT 0,
 gps_state TEXT NOT NULL DEFAULT 'inside', last_seen TIMESTAMPTZ, exit_candidate JSONB,
 UNIQUE(employee_id,shift_start), CHECK(shift_end>shift_start)
);
CREATE UNIQUE INDEX IF NOT EXISTS one_inside_record ON duty_records(employee_id) WHERE state='inside';
CREATE TABLE IF NOT EXISTS attendance_events (
 id BIGSERIAL PRIMARY KEY, record_id BIGINT REFERENCES duty_records(id), employee_id INTEGER NOT NULL REFERENCES accounts(id),
 kind TEXT NOT NULL, captured_at TIMESTAMPTZ, received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 details JSONB NOT NULL DEFAULT '{}', request_id UUID, UNIQUE(employee_id,request_id)
);
CREATE TABLE IF NOT EXISTS audit_log (
 id BIGSERIAL PRIMARY KEY, actor_id INTEGER REFERENCES accounts(id), action TEXT NOT NULL,
 target TEXT, reason TEXT, details JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS leave_requests (
 id BIGSERIAL PRIMARY KEY, employee_id INTEGER NOT NULL REFERENCES accounts(id), from_date DATE NOT NULL,
 to_date DATE NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 reviewed_by INTEGER REFERENCES accounts(id), comment TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), CHECK(to_date>=from_date)
);
CREATE INDEX IF NOT EXISTS duty_employee_time ON duty_records(employee_id,shift_start DESC);
CREATE INDEX IF NOT EXISTS event_employee_time ON attendance_events(employee_id,received_at DESC);
CREATE INDEX IF NOT EXISTS auth_expiry ON auth_sessions(expires_at);
