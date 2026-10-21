--
-- PostgreSQL database dump
--

-- \restrict tXcDZ5gKdYb0uBj4lvbTFq3ymAcciIb0Vtd9FAoBAY6Q4pusxoTAhoOC5oC8ojw

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: accounts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.accounts (
    id integer NOT NULL,
    identifier text NOT NULL,
    name text NOT NULL,
    password_hash text NOT NULL,
    role text NOT NULL,
    branch_id integer,
    shift_id integer,
    department_id integer,
    email text,
    phone text,
    bound_device_id text,
    bound_device_name text,
    device_bound_at timestamp with time zone,
    permissions text[] DEFAULT '{}'::text[] NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    avatar text,
    CONSTRAINT accounts_role_check CHECK ((role = ANY (ARRAY['super_admin'::text, 'hr_admin'::text, 'branch_manager'::text, 'viewer'::text, 'employee'::text])))
);


ALTER TABLE public.accounts OWNER TO postgres;

--
-- Name: accounts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.accounts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.accounts_id_seq OWNER TO postgres;

--
-- Name: accounts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.accounts_id_seq OWNED BY public.accounts.id;


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.announcements (
    id integer NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying,
    sender_id integer,
    sender_name character varying(150),
    send_email boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    active boolean DEFAULT true
);


ALTER TABLE public.announcements OWNER TO postgres;

--
-- Name: announcements_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.announcements_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.announcements_id_seq OWNER TO postgres;

--
-- Name: announcements_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.announcements_id_seq OWNED BY public.announcements.id;


--
-- Name: attendance_events; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.attendance_events (
    id bigint NOT NULL,
    record_id bigint,
    employee_id integer NOT NULL,
    kind text NOT NULL,
    captured_at timestamp with time zone,
    received_at timestamp with time zone DEFAULT now() NOT NULL,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    request_id uuid
);


ALTER TABLE public.attendance_events OWNER TO postgres;

--
-- Name: attendance_events_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.attendance_events_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.attendance_events_id_seq OWNER TO postgres;

--
-- Name: attendance_events_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.attendance_events_id_seq OWNED BY public.attendance_events.id;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.audit_log (
    id bigint NOT NULL,
    actor_id integer,
    action text NOT NULL,
    target text,
    reason text,
    details jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.audit_log OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.audit_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.audit_log_id_seq OWNER TO postgres;

--
-- Name: audit_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.audit_log_id_seq OWNED BY public.audit_log.id;


--
-- Name: auth_sessions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.auth_sessions (
    token_hash text NOT NULL,
    account_id integer NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.auth_sessions OWNER TO postgres;

--
-- Name: branches; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.branches (
    id integer NOT NULL,
    name text NOT NULL,
    latitude double precision NOT NULL,
    longitude double precision NOT NULL,
    entry_radius integer NOT NULL,
    exit_radius integer NOT NULL,
    max_accuracy integer NOT NULL,
    exit_samples integer DEFAULT 3 NOT NULL,
    exit_delay_seconds integer DEFAULT 120 NOT NULL,
    active boolean DEFAULT true NOT NULL,
    location_revision integer DEFAULT 1 NOT NULL,
    qr_revision integer DEFAULT 1 NOT NULL,
    CONSTRAINT branches_check CHECK (((exit_radius > entry_radius) AND (exit_radius <= 2000))),
    CONSTRAINT branches_entry_radius_check CHECK (((entry_radius >= 10) AND (entry_radius <= 1000))),
    CONSTRAINT branches_exit_delay_seconds_check CHECK (((exit_delay_seconds >= 30) AND (exit_delay_seconds <= 600))),
    CONSTRAINT branches_exit_samples_check CHECK (((exit_samples >= 2) AND (exit_samples <= 10))),
    CONSTRAINT branches_latitude_check CHECK (((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))),
    CONSTRAINT branches_longitude_check CHECK (((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision))),
    CONSTRAINT branches_max_accuracy_check CHECK (((max_accuracy >= 1) AND (max_accuracy <= 100)))
);


ALTER TABLE public.branches OWNER TO postgres;

--
-- Name: branches_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.branches_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.branches_id_seq OWNER TO postgres;

--
-- Name: branches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.branches_id_seq OWNED BY public.branches.id;


--
-- Name: departments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.departments (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE public.departments OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.departments_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.departments_id_seq OWNER TO postgres;

--
-- Name: departments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.departments_id_seq OWNED BY public.departments.id;


--
-- Name: duty_records; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.duty_records (
    id bigint NOT NULL,
    employee_id integer NOT NULL,
    branch_id integer NOT NULL,
    shift_id integer NOT NULL,
    shift_start timestamp with time zone NOT NULL,
    shift_end timestamp with time zone NOT NULL,
    first_in timestamp with time zone NOT NULL,
    last_out timestamp with time zone,
    state text NOT NULL,
    exit_reason text,
    close_policy text NOT NULL,
    deduct_away boolean NOT NULL,
    away_started timestamp with time zone,
    away_seconds integer DEFAULT 0 NOT NULL,
    late_minutes integer DEFAULT 0 NOT NULL,
    gps_state text DEFAULT 'inside'::text NOT NULL,
    last_seen timestamp with time zone,
    exit_candidate jsonb,
    CONSTRAINT duty_records_check CHECK ((shift_end > shift_start)),
    CONSTRAINT duty_records_close_policy_check CHECK ((close_policy = ANY (ARRAY['actual_exit'::text, 'scheduled'::text]))),
    CONSTRAINT duty_records_state_check CHECK ((state = ANY (ARRAY['inside'::text, 'outside'::text, 'closed'::text])))
);


ALTER TABLE public.duty_records OWNER TO postgres;

--
-- Name: duty_records_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.duty_records_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.duty_records_id_seq OWNER TO postgres;

--
-- Name: duty_records_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.duty_records_id_seq OWNED BY public.duty_records.id;


--
-- Name: leave_requests; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.leave_requests (
    id bigint NOT NULL,
    employee_id integer NOT NULL,
    from_date date NOT NULL,
    to_date date NOT NULL,
    reason text NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    reviewed_by integer,
    comment text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT leave_requests_check CHECK ((to_date >= from_date)),
    CONSTRAINT leave_requests_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'rejected'::text])))
);


ALTER TABLE public.leave_requests OWNER TO postgres;

--
-- Name: leave_requests_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.leave_requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.leave_requests_id_seq OWNER TO postgres;

--
-- Name: leave_requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.leave_requests_id_seq OWNED BY public.leave_requests.id;


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.shifts (
    id integer NOT NULL,
    name text NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    work_days integer[] DEFAULT '{0,1,2,3,4}'::integer[] NOT NULL,
    grace_minutes integer DEFAULT 15 NOT NULL,
    close_policy text DEFAULT 'actual_exit'::text NOT NULL,
    deduct_away boolean DEFAULT false NOT NULL,
    CONSTRAINT shifts_check CHECK ((start_time <> end_time)),
    CONSTRAINT shifts_close_policy_check CHECK ((close_policy = ANY (ARRAY['actual_exit'::text, 'scheduled'::text]))),
    CONSTRAINT shifts_grace_minutes_check CHECK (((grace_minutes >= 0) AND (grace_minutes <= 120)))
);


ALTER TABLE public.shifts OWNER TO postgres;

--
-- Name: shifts_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.shifts_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.shifts_id_seq OWNER TO postgres;

--
-- Name: shifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.shifts_id_seq OWNED BY public.shifts.id;


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.system_settings (
    key text NOT NULL,
    value text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.system_settings OWNER TO postgres;

--
-- Name: accounts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts ALTER COLUMN id SET DEFAULT nextval('public.accounts_id_seq'::regclass);


--
-- Name: announcements id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements ALTER COLUMN id SET DEFAULT nextval('public.announcements_id_seq'::regclass);


--
-- Name: attendance_events id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_events ALTER COLUMN id SET DEFAULT nextval('public.attendance_events_id_seq'::regclass);


--
-- Name: audit_log id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log ALTER COLUMN id SET DEFAULT nextval('public.audit_log_id_seq'::regclass);


--
-- Name: branches id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches ALTER COLUMN id SET DEFAULT nextval('public.branches_id_seq'::regclass);


--
-- Name: departments id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments ALTER COLUMN id SET DEFAULT nextval('public.departments_id_seq'::regclass);


--
-- Name: duty_records id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.duty_records ALTER COLUMN id SET DEFAULT nextval('public.duty_records_id_seq'::regclass);


--
-- Name: leave_requests id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests ALTER COLUMN id SET DEFAULT nextval('public.leave_requests_id_seq'::regclass);


--
-- Name: shifts id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts ALTER COLUMN id SET DEFAULT nextval('public.shifts_id_seq'::regclass);


--
-- Data for Name: accounts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.accounts (id, identifier, name, password_hash, role, branch_id, shift_id, department_id, email, phone, bound_device_id, bound_device_name, device_bound_at, permissions, active, created_at, avatar) FROM stdin;
2	001	عبدالغني	scrypt:cd44dc7a8c3db76cfad75f0c6dbf3a34:e474b7b41f0f6f5da3d0baf6bb8bb625dd5007a6afe2e74602de7f0c513cb2a52a5064e36520e0493d9315df17c7781cb2dab5507acfda0cc9472ea75ef7d3c3	super_admin	1	\N	\N	\N	\N	\N	\N	\N	{employees.write}	t	2026-10-19 01:35:23.39296-07	\N
7	emp1	أحمد الموظف	scrypt:0d9b23d45c2570118293aab979247c12:0a82e34506393c9fd2a7935017a6360ab2b2170d454dc4c6533473a333ff56043619c79a3845597b99e383090a67ee73eccd4c62b35aa0f3761bfc5ace92a1e4	employee	1	1	\N	\N	\N	\N	\N	\N	{}	t	2026-10-20 00:48:52.768716-07	\N
8	003	Anoos Aziz	scrypt:6f9ae20f9e353ab150e148dd392a7068:130ea2de2e32617ef910000180f55921326a76c04db423b64ab40ac4796e971f6e3923f9adf02eeaaf735d3189050405ebca0c9f32c6dbf4d2e0614fd2e498f4	employee	1	1	\N	anoos.x700@gmail.com	\N	bcd162e1-3d54-451a-bc83-1a03fc78a6f9	كمبيوتر Windows	2026-10-20 01:27:17.075-07	{}	t	2026-10-20 01:27:17.001599-07	\N
3	002	عبدو	scrypt:23d6355d1a35b6768ebf32b6880f3fc5:5945ea9ffd32541b0127ae658f5a77c14d127ccb8fe0d4f22f9db75dbb464ad5c7c3bcfe2d35cc89a918c9a515f1b6ddcba297ce4836f4483ded7dfc27adbd83	employee	1	1	\N	\N	\N	\N	\N	\N	{}	t	2026-10-19 01:37:39.225532-07	\N
9	004	Abdulghani Ali Ashebami	scrypt:462c259a418b50adfead8f47bc6babf0:5a87da1ad86911f86b68736c990d758b91a9a6c4b68673b6444af08f970805a19c1462dd20b0b43a3e82d534b37366b57064d2942c81b74c1281dd771061981a	employee	1	1	\N	samyemen987@gmail.com	\N	f76f1efd-3434-4b23-a574-fd9591895296	هاتف K	2026-10-20 01:51:11.194-07	{}	t	2026-10-20 01:51:11.115479-07	\N
1	admin	مدير أساس	scrypt:3eea07cbed599a869a74b4fbcc0afa31:890cf6ae937c78fb1ed2a106fb9c5055ad6a7268819648f317dffa76b47033f7938324c488329e08cd7cf6d95e8c26bad93353e8d97f939f3247ae3864a1f6ce	super_admin	1	1	\N	\N	+967 771234567	\N	\N	\N	{}	t	2026-10-19 00:27:22.407292-07	avatar_male_1
\.


--
-- Data for Name: announcements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.announcements (id, title, content, priority, sender_id, sender_name, send_email, created_at, active) FROM stdin;
1	مرحباً بكم في نظام أساس المحدث	نرحب بجميع الزملاء والزميلات في التحديث الجديد لنظام أساس مع واجهة عصرية وميزات لحظية.	important	1	مدير أساس	f	2026-10-20 03:01:04.896866-07	t
\.


--
-- Data for Name: attendance_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance_events (id, record_id, employee_id, kind, captured_at, received_at, details, request_id) FROM stdin;
1	1	3	enter	2026-10-19 01:44:11.266-07	2026-10-19 01:44:12.975812-07	{"fix": {"accuracy": 14, "latitude": 15.3061403, "longitude": 44.1982556, "captured_at": "2026-10-19T08:44:11.266Z"}, "location": {"state": "inside", "distance": 21.95002177205885}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.305997563629154, "longitude": 44.19811422708618, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 1, "exit_delay_seconds": 120}}	ceb9ad18-9a28-494e-aa03-0e090b7da7ac
2	1	3	location	2026-10-19 01:44:41.371-07	2026-10-19 01:44:41.833472-07	{"accuracy": 15, "location": {"state": "inside", "distance": 12.958608227344667}, "revision": 1}	bbbb9a35-cb98-4327-9826-f54b4bb5efc1
3	1	3	location	2026-10-19 01:45:06.367-07	2026-10-19 01:45:06.16875-07	{"accuracy": 18, "location": {"state": "inside", "distance": 20.198635226637737}, "revision": 1}	7296dd85-b139-4e3b-8179-8dd653fded85
4	1	3	location	2026-10-19 02:36:31.722-07	2026-10-19 02:36:31.542631-07	{"accuracy": 22, "location": {"state": "inside", "distance": 17.37307132087989}, "revision": 1}	d7f9f397-aba6-4562-b0fe-afa3cb8d86f6
5	1	3	location	2026-10-19 02:36:56.285-07	2026-10-19 02:36:57.207913-07	{"accuracy": 19, "location": {"state": "inside", "distance": 17.697963825127}, "revision": 1}	605d631d-6855-4b72-b599-5c87a48c87c7
6	1	3	location	2026-10-19 02:37:20.151-07	2026-10-19 02:37:20.504965-07	{"accuracy": 19, "location": {"state": "outside", "distance": 4283685.32180588}, "revision": 2}	68032578-166c-418c-b7c6-5a3aba008818
7	1	3	location	2026-10-19 02:37:46.461-07	2026-10-19 02:37:46.823541-07	{"accuracy": 13, "location": {"state": "outside", "distance": 4283682.7052096175}, "revision": 2}	40c1c553-c8d7-4dd0-9daa-5135cf42dca2
8	1	3	location	2026-10-19 02:40:50.064-07	2026-10-19 02:40:50.943536-07	{"accuracy": 17, "location": {"state": "outside", "distance": 4283686.515506429}, "revision": 2}	4d74b3ac-f6c5-4aa9-9062-82cc665610ce
9	1	3	location	2026-10-19 02:41:15.464-07	2026-10-19 02:41:15.767311-07	{"accuracy": 24, "location": {"state": "outside", "distance": 4283681.47899892}, "revision": 2}	5cad27cf-14e3-4280-b5e7-01369a34d2d1
10	1	3	location	2026-10-19 02:41:40.345-07	2026-10-19 02:41:41.176785-07	{"accuracy": 19, "location": {"state": "outside", "distance": 4283684.955343651}, "revision": 2}	e313b825-63f4-41ce-9bca-da1ad9c7b56c
11	1	3	location	2026-10-19 02:42:05.536-07	2026-10-19 02:42:05.870997-07	{"accuracy": 21, "location": {"state": "outside", "distance": 4283688.43895948}, "revision": 2}	54ca2176-ceed-4393-a880-ef77ce49bd66
12	1	3	location	2026-10-19 02:42:30.315-07	2026-10-19 02:42:30.617435-07	{"accuracy": 19, "location": {"state": "outside", "distance": 4283686.538711378}, "revision": 2}	791076b9-7eb4-4e43-8bce-159ddbb6808a
13	1	3	auto_exit	2026-10-19 02:42:55.407-07	2026-10-19 02:42:55.705083-07	{"fix": {"accuracy": 20, "latitude": 15.3061214, "longitude": 44.1982303, "captured_at": "2026-10-19T09:42:55.407Z"}, "location": {"state": "outside", "distance": 4283687.803616795}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.305997563629154, "longitude": 4.19811422708618, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 2, "exit_delay_seconds": 120}}	b940e072-26c5-4a60-b3e1-180a762e0190
14	1	3	return	2026-10-19 02:44:27.593-07	2026-10-19 02:44:32.920983-07	{"fix": {"accuracy": 38, "latitude": 15.3061537, "longitude": 44.1982307, "captured_at": "2026-10-19T09:44:27.593Z"}, "location": {"state": "inside", "reason": "low_accuracy", "distance": 21.103938688135024}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.30597095488937, "longitude": 44.19828382228983, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 3, "exit_delay_seconds": 120}}	814883aa-37c0-4b33-aa7d-9135a234864a
15	1	3	location	2026-10-19 02:44:59.367-07	2026-10-19 02:45:04.656793-07	{"accuracy": 49, "location": {"state": "outside", "reason": "low_accuracy", "distance": 107118.12598593274}, "revision": 4}	75cedbff-4376-4047-bcf1-e67dc2863795
16	2	8	enter	2026-10-20 01:54:23.983-07	2026-10-20 01:54:22.576707-07	{"fix": {"accuracy": 102, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "captured_at": "2026-10-20T08:54:23.983Z"}, "is_auto": true, "location": {"state": "inside", "reason": "low_accuracy", "distance": 0}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	bef3cb22-4eb2-44cd-a7b7-e8e391f25d28
17	3	9	enter	2026-10-20 01:55:03.897-07	2026-10-20 01:55:04.391539-07	{"fix": {"accuracy": 19, "latitude": 15.3061181, "longitude": 44.1982468, "captured_at": "2026-10-20T08:55:03.897Z"}, "is_auto": false, "location": {"state": "inside", "distance": 12.720696554895563}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	863c0a0e-751b-461e-928f-fb222f143a4f
18	3	9	location	2026-10-20 01:55:32.186-07	2026-10-20 01:55:32.944586-07	{"accuracy": 14, "location": {"state": "inside", "distance": 0.7771528986488038}, "revision": 10}	31b44548-56c7-4195-bbac-31d2cdc0a783
19	3	9	location	2026-10-20 01:56:25.562-07	2026-10-20 01:56:26.297243-07	{"accuracy": 17, "location": {"state": "inside", "distance": 13.793270740545172}, "revision": 10}	7e5a1c39-7457-4e7c-8bea-e311b2bdd887
20	2	8	exit	2026-10-20 02:00:40.111-07	2026-10-20 02:00:38.685643-07	{"fix": {"accuracy": 109, "latitude": 15.305998676024073, "longitude": 44.198301545557136, "captured_at": "2026-10-20T09:00:40.111Z"}, "is_auto": false, "location": {"state": "inside", "reason": "low_accuracy", "distance": 13.332872789677362}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 599 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	b3d2ef98-b7ec-433f-9be4-67f7897055d9
21	2	8	return	2026-10-20 02:00:45.975-07	2026-10-20 02:00:44.591071-07	{"fix": {"accuracy": 109, "latitude": 15.305998676024073, "longitude": 44.198301545557136, "captured_at": "2026-10-20T09:00:45.975Z"}, "is_auto": false, "location": {"state": "inside", "reason": "low_accuracy", "distance": 13.332872789677362}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	34fe9671-55c2-4108-bc28-3178c1a75451
22	2	8	exit	2026-10-20 02:00:57.182-07	2026-10-20 02:00:55.78188-07	{"fix": {"accuracy": 109, "latitude": 15.305998676024073, "longitude": 44.198301545557136, "captured_at": "2026-10-20T09:00:57.182Z"}, "is_auto": true, "location": {"state": "inside", "reason": "low_accuracy", "distance": 13.332872789677362}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 599 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	f22db42f-1c2d-4548-8239-8d64a2f49d30
23	2	8	return	2026-10-20 02:01:03.173-07	2026-10-20 02:01:01.755175-07	{"fix": {"accuracy": 109, "latitude": 15.305998676024073, "longitude": 44.198301545557136, "captured_at": "2026-10-20T09:01:03.173Z"}, "is_auto": false, "location": {"state": "inside", "reason": "low_accuracy", "distance": 13.332872789677362}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	4fbb97e4-b81f-41bf-8d37-45cbee31f140
24	3	9	exit	2026-10-20 02:19:50.242-07	2026-10-20 02:19:53.01355-07	{"fix": {"accuracy": 24, "latitude": 15.3062676, "longitude": 44.1982012, "captured_at": "2026-10-20T09:19:50.242Z"}, "is_auto": true, "location": {"state": "inside", "distance": 27.22667736415627}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 580 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	6386f0ce-3b71-4db0-b98f-c202c7e7492f
25	3	9	return	2026-10-20 02:20:29.839-07	2026-10-20 02:20:30.839927-07	{"fix": {"accuracy": 47, "latitude": 15.3060274, "longitude": 44.1981641, "captured_at": "2026-10-20T09:20:29.839Z"}, "is_auto": true, "location": {"state": "inside", "reason": "low_accuracy", "distance": 1.7512175699653412}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	97645510-5cfb-413f-9915-475d94d0becc
26	2	8	exit	2026-10-20 02:39:17.682-07	2026-10-20 02:39:16.488399-07	{"fix": {"accuracy": 111, "latitude": 15.306004991148175, "longitude": 44.19833596682437, "captured_at": "2026-10-20T09:39:17.682Z"}, "is_auto": false, "location": {"state": "inside", "reason": "low_accuracy", "distance": 16.860772519289547}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 561 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	2c5f0aa2-fb55-4f2b-9f54-2530d78c9795
27	3	9	exit	2026-10-20 02:41:48.361-07	2026-10-20 02:41:49.815112-07	{"fix": {"accuracy": 23, "latitude": 15.3063186, "longitude": 44.1981869, "captured_at": "2026-10-20T09:41:48.361Z"}, "is_auto": true, "location": {"state": "inside", "distance": 32.8105106282498}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 558 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	e470fd46-ff4c-4da3-be24-929d7045fb91
28	3	9	return	2026-10-20 02:42:25.123-07	2026-10-20 02:42:26.247017-07	{"fix": {"accuracy": 25, "latitude": 15.3060938, "longitude": 44.1982338, "captured_at": "2026-10-20T09:42:25.123Z"}, "is_auto": true, "location": {"state": "inside", "distance": 9.710006400547867}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	607569b6-06b2-4817-82fc-1b01eb5a71bb
29	3	9	location	2026-10-20 03:29:00.489-07	2026-10-20 03:29:00.905925-07	{"accuracy": 19, "location": {"state": "inside", "distance": 8.339671099945717}, "revision": 10}	96be61d0-f15b-4dfd-8962-ca4749fc57e3
30	3	9	exit	2026-10-20 03:29:05.999-07	2026-10-20 03:29:06.316217-07	{"fix": {"accuracy": 38, "latitude": 15.3061388, "longitude": 44.1982476, "captured_at": "2026-10-20T10:29:05.999Z"}, "is_auto": true, "location": {"state": "inside", "reason": "low_accuracy", "distance": 14.721500979410843}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 511 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	95cefa8b-ad8e-4f3e-86a4-b3635bd10c71
31	3	9	return	2026-10-20 03:29:29.266-07	2026-10-20 03:29:29.539382-07	{"fix": {"accuracy": 18, "latitude": 15.3060775, "longitude": 44.1982441, "captured_at": "2026-10-20T10:29:29.266Z"}, "is_auto": false, "location": {"state": "inside", "distance": 9.124482341552351}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	c3669494-807f-455c-b9c8-89463446d048
32	3	9	exit	2026-10-20 03:29:43.5-07	2026-10-20 03:29:44.209097-07	{"fix": {"accuracy": 26, "latitude": 15.3059959, "longitude": 44.1982534, "captured_at": "2026-10-20T10:29:43.500Z"}, "is_auto": true, "location": {"state": "inside", "distance": 8.458798383499756}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 510 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	ecf71068-3fb6-4ba9-b2c8-352f06bf2dd9
33	3	9	return	2026-10-20 03:33:34.414-07	2026-10-20 03:33:35.58291-07	{"fix": {"accuracy": 12, "latitude": 15.3060436, "longitude": 44.1982114, "captured_at": "2026-10-20T10:33:34.414Z"}, "is_auto": true, "location": {"state": "inside", "distance": 4.040205906499297}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	c83df730-ae0d-48a0-8b7e-294c5233485a
34	3	9	exit	2026-10-20 03:34:11.814-07	2026-10-20 03:34:12.399593-07	{"fix": {"accuracy": 31, "latitude": 15.3061483, "longitude": 44.1981913, "captured_at": "2026-10-20T10:34:11.814Z"}, "is_auto": true, "location": {"state": "inside", "reason": "low_accuracy", "distance": 13.918900491130156}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 506 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	c090ae6e-5bba-4deb-8f95-c582f738b0ad
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.audit_log (id, actor_id, action, target, reason, details, created_at) FROM stdin;
1	1	branch.create	1	test	{}	2026-10-19 01:34:13.399186-07
2	1	account.create	2	إضافة حساب	{}	2026-10-19 01:35:23.39296-07
3	1	shift.create	1	إنشاء جدول	{}	2026-10-19 01:35:53.62987-07
4	1	shift.update	1	تعديل	{"policy_snapshot": "Existing duty records unchanged"}	2026-10-19 01:36:12.734899-07
5	1	account.create	3	إضافة حساب	{}	2026-10-19 01:37:39.225532-07
6	1	account.reset_device	3	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "كمبيوتر Windows", "previous_device_id": "1d4a5ad7-c20f-4926-90ab-8e734b275f85"}	2026-10-19 01:40:51.292694-07
7	1	qr.revoke	1	شس	{}	2026-10-19 01:42:52.958603-07
8	1	account.reset_device	3	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "هاتف K", "previous_device_id": "2dc671f8-4141-4fdd-bb53-8f1ca2ceb008"}	2026-10-19 01:45:19.731726-07
9	1	attendance.edit	1	ش	{"after": {"id": "1", "state": "inside", "first_in": "2026-10-19T08:44:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-19T08:45:06.169Z", "shift_end": "2026-10-19T19:00:00.000Z", "deduct_away": true, "employee_id": 3, "exit_reason": "manual", "shift_start": "2026-10-19T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 209, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-19T08:45:06.367Z", "revision": 1, "last_received": "2026-10-19T08:45:06.169Z"}}, "before": {"id": "1", "state": "inside", "first_in": "2026-10-19T08:44:12.988Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-19T08:45:06.169Z", "shift_end": "2026-10-19T19:00:00.000Z", "deduct_away": true, "employee_id": 3, "exit_reason": null, "shift_start": "2026-10-19T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 209, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-19T08:45:06.367Z", "revision": 1, "last_received": "2026-10-19T08:45:06.169Z"}}}	2026-10-19 02:19:28.183971-07
10	1	attendance.edit	1	شش	{"after": {"id": "1", "state": "inside", "first_in": "2026-10-19T08:44:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-19T08:45:06.169Z", "shift_end": "2026-10-19T19:00:00.000Z", "deduct_away": true, "employee_id": 3, "exit_reason": "admin_correction", "shift_start": "2026-10-19T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 209, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-19T08:45:06.367Z", "revision": 1, "last_received": "2026-10-19T08:45:06.169Z"}}, "before": {"id": "1", "state": "inside", "first_in": "2026-10-19T08:44:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-19T08:45:06.169Z", "shift_end": "2026-10-19T19:00:00.000Z", "deduct_away": true, "employee_id": 3, "exit_reason": "manual", "shift_start": "2026-10-19T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 209, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-19T08:45:06.367Z", "revision": 1, "last_received": "2026-10-19T08:45:06.169Z"}}}	2026-10-19 02:20:19.901122-07
11	1	branch.update	1	تغير	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.305997563629154, "longitude": 4.19811422708618, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 2, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.305997563629154, "longitude": 44.19811422708618, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 1, "exit_delay_seconds": 120}}	2026-10-19 02:37:03.696998-07
12	1	account.reset_device	3	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "هاتف K", "previous_device_id": "2dc671f8-4141-4fdd-bb53-8f1ca2ceb008"}	2026-10-19 02:39:44.69839-07
13	1	branch.update	1	aaaa	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.30597095488937, "longitude": 44.19828382228983, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 3, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.305997563629154, "longitude": 4.19811422708618, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 2, "exit_delay_seconds": 120}}	2026-10-19 02:44:05.065273-07
14	1	branch.update	1	jydv	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.30597095488937, "longitude": 43.19828382228983, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 4, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.30597095488937, "longitude": 44.19828382228983, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 3, "exit_delay_seconds": 120}}	2026-10-19 02:44:54.215157-07
15	1	attendance.edit	1	A	{"after": {"id": "1", "state": "closed", "first_in": "2026-10-19T08:44:00.000Z", "last_out": "2026-10-19T09:42:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "outside", "last_seen": "2026-10-19T09:45:04.657Z", "shift_end": "2026-10-19T19:00:00.000Z", "deduct_away": true, "employee_id": 3, "exit_reason": "manual", "shift_start": "2026-10-19T05:00:00.000Z", "away_seconds": 97, "away_started": null, "close_policy": "actual_exit", "late_minutes": 209, "exit_candidate": {"exit": false, "count": 1, "since": "2026-10-19T09:45:04.657Z", "last_fix": "2026-10-19T09:44:59.367Z", "revision": 4, "last_received": "2026-10-19T09:45:04.657Z"}}, "before": {"id": "1", "state": "inside", "first_in": "2026-10-19T08:44:00.000Z", "last_out": "2026-10-19T09:42:55.705Z", "shift_id": 1, "branch_id": 1, "gps_state": "outside", "last_seen": "2026-10-19T09:45:04.657Z", "shift_end": "2026-10-19T19:00:00.000Z", "deduct_away": true, "employee_id": 3, "exit_reason": "geofence", "shift_start": "2026-10-19T05:00:00.000Z", "away_seconds": 97, "away_started": null, "close_policy": "actual_exit", "late_minutes": 209, "exit_candidate": {"exit": false, "count": 1, "since": "2026-10-19T09:45:04.657Z", "last_fix": "2026-10-19T09:44:59.367Z", "revision": 4, "last_received": "2026-10-19T09:45:04.657Z"}}}	2026-10-19 04:17:32.739105-07
16	1	reports.export	attendance	تصدير Word	{"count": 1}	2026-10-19 04:20:05.594152-07
17	1	reports.export	attendance	تصدير TXT	{"count": 1}	2026-10-19 04:20:17.107318-07
18	1	reports.export	attendance	تصدير CSV	{"count": 1}	2026-10-19 04:38:55.604238-07
19	1	account.reset_device	3	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "هاتف K", "previous_device_id": "f76f1efd-3434-4b23-a574-fd9591895296"}	2026-10-20 01:50:55.50336-07
20	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3522, "longitude": 44.2095, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 5, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.30597095488937, "longitude": 43.19828382228983, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 4, "exit_delay_seconds": 120}}	2026-10-20 01:54:08.532205-07
21	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3522, "longitude": 44.2095, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 6, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3522, "longitude": 44.2095, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 5, "exit_delay_seconds": 120}}	2026-10-20 01:54:08.569776-07
22	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3522, "longitude": 44.2095, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 7, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3522, "longitude": 44.2095, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 6, "exit_delay_seconds": 120}}	2026-10-20 01:54:09.281192-07
23	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 8, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3522, "longitude": 44.2095, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 7, "exit_delay_seconds": 120}}	2026-10-20 01:54:09.310631-07
24	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 9, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 8, "exit_delay_seconds": 120}}	2026-10-20 01:54:11.21979-07
25	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 9, "exit_delay_seconds": 120}}	2026-10-20 01:54:13.237002-07
26	1	reports.export	attendance	تصدير TXT	{"count": 2}	2026-10-20 02:34:33.295694-07
27	1	announcement.create	1	مرحباً بكم في نظام أساس المحدث	{}	2026-10-20 03:01:04.896866-07
28	1	settings.update	null	تحديث إعدادات النظام الحقيقية	{}	2026-10-20 03:01:04.920252-07
29	1	account.create	10	إضافة حساب	{}	2026-10-20 04:29:17.118272-07
30	\N	test.action	target	test reason	{}	2026-10-20 04:29:17.137879-07
31	1	account.delete	10	حذف حساب الموظف (موظف تجربة للحذف)	{"identifier": "999", "account_name": "موظف تجربة للحذف"}	2026-10-20 04:29:17.145519-07
\.


--
-- Data for Name: auth_sessions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.auth_sessions (token_hash, account_id, expires_at, created_at) FROM stdin;
e447f02ca89f650ac295a7c92296308e90d929f344eca5aa8e9746a45d970f3f	1	2027-10-20 02:31:11.390551-07	2026-10-19 00:27:51.679787-07
68aecccfd564edeb8b04c41cc9c72059592602ee9229f92c110670dbbec51d1c	1	2027-10-20 02:31:11.390551-07	2026-10-19 00:35:00.771901-07
d8d55401df496a286122a414e8737d4a900561945332bb8b79693bf4f3d8ffa9	1	2027-10-20 02:31:11.390551-07	2026-10-19 01:29:19.478462-07
ef54828a2e33770ca0d2be5a24b374878d3cdabb98119a9c9265826ff6e3a29c	1	2027-10-20 02:31:11.390551-07	2026-10-19 01:32:11.12537-07
2346183ff89f55de09e68c5aa760e6b94d86286601377d199ce0e62e6f4193a0	1	2027-10-20 02:31:11.390551-07	2026-10-19 02:10:35.210704-07
8fa14d607a29a238242cfbc18768b5e5877e4d93bcc7e025fd431892b80bc206	1	2027-10-20 02:31:11.390551-07	2026-10-19 02:30:54.258063-07
01ca534270dc4a83fe51d8bf94272c0f3cc3378b849bf6e24ea671c98935fb06	1	2027-10-20 02:31:11.390551-07	2026-10-19 02:34:42.995737-07
564d8ebcd0bda0b973d76f3d193deea55a109d002c060f4ad43cd912be52cde4	1	2027-10-20 02:31:11.390551-07	2026-10-19 02:34:58.665517-07
8fcb83390fb5d2007e8e19b97eb6274a22a371a9f9969215ef1816ab93270d3e	1	2027-10-20 02:31:11.390551-07	2026-10-19 04:15:01.247948-07
80b0de11d98782de011a7ef02f3755db3e4959100f14b847dbec0d9899e0b816	9	2027-10-20 02:31:11.390551-07	2026-10-20 01:51:11.201727-07
ea59784c3141dacb3978ca43327b5d52b1b8c07041bf302effb1b7ba80e4593f	1	2027-10-20 02:31:11.390551-07	2026-10-20 01:53:49.928295-07
b417cb08cebd3de1cf65c4b1cadcf3811818942c20e565486f6c6c1cacec3b25	1	2027-10-20 02:38:24.780101-07	2026-10-20 02:38:24.780101-07
fbe6eb621493fd4ee91563c1a7d804989b6c6fe9f9991fd39f9f02746a32cd96	1	2027-10-20 03:01:04.795878-07	2026-10-20 03:01:04.795878-07
dfc983965a47e41806c542097f18bae678e9c1b482e7e60e31e71ec109f2431f	1	2026-10-21 04:29:07.893389-07	2026-10-20 04:29:07.893389-07
4da44112ed41155f2d4772e99db0cff12e6c2f1ebbcc066d069a2e6979155496	1	2026-10-21 04:29:17.003441-07	2026-10-20 04:29:17.003441-07
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branches (id, name, latitude, longitude, entry_radius, exit_radius, max_accuracy, exit_samples, exit_delay_seconds, active, location_revision, qr_revision) FROM stdin;
1	AI-ASAAS	15.306023604211699	44.19817994690613	80	120	30	3	120	t	10	2
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name) FROM stdin;
\.


--
-- Data for Name: duty_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.duty_records (id, employee_id, branch_id, shift_id, shift_start, shift_end, first_in, last_out, state, exit_reason, close_policy, deduct_away, away_started, away_seconds, late_minutes, gps_state, last_seen, exit_candidate) FROM stdin;
2	8	1	1	2026-10-19 22:00:00-07	2026-10-20 12:00:00-07	2026-10-20 01:54:22.577-07	2026-10-20 02:39:16.49-07	outside	خروج مبكر قبل نهاية الدوام بـ 561 دقيقة	actual_exit	t	2026-10-20 02:39:16.49-07	10	219	inside	2026-10-20 02:39:16.49-07	\N
3	9	1	1	2026-10-19 22:00:00-07	2026-10-20 12:00:00-07	2026-10-20 01:55:04.391-07	2026-10-20 03:34:12.4-07	outside	خروج مبكر قبل نهاية الدوام بـ 506 دقيقة	actual_exit	t	2026-10-20 03:34:12.4-07	327	220	inside	2026-10-20 03:34:12.4-07	\N
1	3	1	1	2026-10-18 22:00:00-07	2026-10-19 12:00:00-07	2026-10-19 01:44:00-07	2026-10-19 02:42:00-07	closed	manual	actual_exit	t	\N	97	209	outside	2026-10-19 02:45:04.657-07	\N
\.


--
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave_requests (id, employee_id, from_date, to_date, reason, status, reviewed_by, comment, created_at) FROM stdin;
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shifts (id, name, start_time, end_time, work_days, grace_minutes, close_policy, deduct_away) FROM stdin;
1	الفتره الاولى	08:00:00	22:00:00	{0,1,2,3,4,6}	15	actual_exit	t
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.system_settings (key, value, updated_at) FROM stdin;
email_notifications	true	2026-10-20 02:57:57.995686-07
company_name	شركة أساس الذكاء الاصطناعي	2026-10-20 03:01:04.920252-07
timezone	Asia/Aden	2026-10-20 03:01:04.920252-07
max_gps_accuracy	250	2026-10-20 03:01:04.920252-07
support_contact	+967 770000000	2026-10-20 03:01:04.920252-07
\.


--
-- Name: accounts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.accounts_id_seq', 10, true);


--
-- Name: announcements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.announcements_id_seq', 1, true);


--
-- Name: attendance_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_events_id_seq', 65, true);


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 31, true);


--
-- Name: branches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.branches_id_seq', 1, true);


--
-- Name: departments_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.departments_id_seq', 1, false);


--
-- Name: duty_records_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.duty_records_id_seq', 3, true);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leave_requests_id_seq', 1, false);


--
-- Name: shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shifts_id_seq', 1, true);


--
-- Name: accounts accounts_identifier_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_identifier_key UNIQUE (identifier);


--
-- Name: accounts accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: attendance_events attendance_events_employee_id_request_id_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT attendance_events_employee_id_request_id_key UNIQUE (employee_id, request_id);


--
-- Name: attendance_events attendance_events_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT attendance_events_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: auth_sessions auth_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_pkey PRIMARY KEY (token_hash);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_key UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: duty_records duty_records_employee_id_shift_start_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.duty_records
    ADD CONSTRAINT duty_records_employee_id_shift_start_key UNIQUE (employee_id, shift_start);


--
-- Name: duty_records duty_records_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.duty_records
    ADD CONSTRAINT duty_records_pkey PRIMARY KEY (id);


--
-- Name: leave_requests leave_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (key);


--
-- Name: accounts_bound_device_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX accounts_bound_device_idx ON public.accounts USING btree (bound_device_id) WHERE (bound_device_id IS NOT NULL);


--
-- Name: accounts_email_unique_idx; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX accounts_email_unique_idx ON public.accounts USING btree (lower(email)) WHERE (email IS NOT NULL);


--
-- Name: auth_expiry; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX auth_expiry ON public.auth_sessions USING btree (expires_at);


--
-- Name: duty_employee_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX duty_employee_time ON public.duty_records USING btree (employee_id, shift_start DESC);


--
-- Name: event_employee_time; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX event_employee_time ON public.attendance_events USING btree (employee_id, received_at DESC);


--
-- Name: one_inside_record; Type: INDEX; Schema: public; Owner: postgres
--

CREATE UNIQUE INDEX one_inside_record ON public.duty_records USING btree (employee_id) WHERE (state = 'inside'::text);


--
-- Name: accounts accounts_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: accounts accounts_department_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_department_id_fkey FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: accounts accounts_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT accounts_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: announcements announcements_sender_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_sender_id_fkey FOREIGN KEY (sender_id) REFERENCES public.accounts(id) ON DELETE SET NULL;


--
-- Name: attendance_events attendance_events_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT attendance_events_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.accounts(id);


--
-- Name: attendance_events attendance_events_record_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.attendance_events
    ADD CONSTRAINT attendance_events_record_id_fkey FOREIGN KEY (record_id) REFERENCES public.duty_records(id);


--
-- Name: audit_log audit_log_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.accounts(id);


--
-- Name: auth_sessions auth_sessions_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.auth_sessions
    ADD CONSTRAINT auth_sessions_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.accounts(id);


--
-- Name: duty_records duty_records_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.duty_records
    ADD CONSTRAINT duty_records_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: duty_records duty_records_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.duty_records
    ADD CONSTRAINT duty_records_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.accounts(id);


--
-- Name: duty_records duty_records_shift_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.duty_records
    ADD CONSTRAINT duty_records_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: leave_requests leave_requests_employee_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_employee_id_fkey FOREIGN KEY (employee_id) REFERENCES public.accounts(id);


--
-- Name: leave_requests leave_requests_reviewed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.leave_requests
    ADD CONSTRAINT leave_requests_reviewed_by_fkey FOREIGN KEY (reviewed_by) REFERENCES public.accounts(id);


--
-- PostgreSQL database dump complete
--

-- \unrestrict tXcDZ5gKdYb0uBj4lvbTFq3ymAcciIb0Vtd9FAoBAY6Q4pusxoTAhoOC5oC8ojw

