--
-- PostgreSQL database dump
--

\restrict INHfFAbzGF81mL80u0xY1U8Kq8gPgYp5bA18jwQcfBZndK8xPJJivzMvV94aQ88

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

ALTER TABLE IF EXISTS ONLY public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_reviewed_by_fkey;
ALTER TABLE IF EXISTS ONLY public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_employee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.duty_records DROP CONSTRAINT IF EXISTS duty_records_shift_id_fkey;
ALTER TABLE IF EXISTS ONLY public.duty_records DROP CONSTRAINT IF EXISTS duty_records_employee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.duty_records DROP CONSTRAINT IF EXISTS duty_records_branch_id_fkey;
ALTER TABLE IF EXISTS ONLY public.auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_account_id_fkey;
ALTER TABLE IF EXISTS ONLY public.audit_log DROP CONSTRAINT IF EXISTS audit_log_actor_id_fkey;
ALTER TABLE IF EXISTS ONLY public.attendance_events DROP CONSTRAINT IF EXISTS attendance_events_record_id_fkey;
ALTER TABLE IF EXISTS ONLY public.attendance_events DROP CONSTRAINT IF EXISTS attendance_events_employee_id_fkey;
ALTER TABLE IF EXISTS ONLY public.announcements DROP CONSTRAINT IF EXISTS announcements_sender_id_fkey;
ALTER TABLE IF EXISTS ONLY public.accounts DROP CONSTRAINT IF EXISTS accounts_shift_id_fkey;
ALTER TABLE IF EXISTS ONLY public.accounts DROP CONSTRAINT IF EXISTS accounts_department_id_fkey;
ALTER TABLE IF EXISTS ONLY public.accounts DROP CONSTRAINT IF EXISTS accounts_branch_id_fkey;
DROP INDEX IF EXISTS public.one_inside_record;
DROP INDEX IF EXISTS public.event_employee_time;
DROP INDEX IF EXISTS public.duty_employee_time;
DROP INDEX IF EXISTS public.auth_expiry;
DROP INDEX IF EXISTS public.accounts_email_unique_idx;
DROP INDEX IF EXISTS public.accounts_bound_device_idx;
ALTER TABLE IF EXISTS ONLY public.system_settings DROP CONSTRAINT IF EXISTS system_settings_pkey;
ALTER TABLE IF EXISTS ONLY public.shifts DROP CONSTRAINT IF EXISTS shifts_pkey;
ALTER TABLE IF EXISTS ONLY public.leave_requests DROP CONSTRAINT IF EXISTS leave_requests_pkey;
ALTER TABLE IF EXISTS ONLY public.duty_records DROP CONSTRAINT IF EXISTS duty_records_pkey;
ALTER TABLE IF EXISTS ONLY public.duty_records DROP CONSTRAINT IF EXISTS duty_records_employee_id_shift_start_key;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_pkey;
ALTER TABLE IF EXISTS ONLY public.departments DROP CONSTRAINT IF EXISTS departments_name_key;
ALTER TABLE IF EXISTS ONLY public.branches DROP CONSTRAINT IF EXISTS branches_pkey;
ALTER TABLE IF EXISTS ONLY public.auth_sessions DROP CONSTRAINT IF EXISTS auth_sessions_pkey;
ALTER TABLE IF EXISTS ONLY public.audit_log DROP CONSTRAINT IF EXISTS audit_log_pkey;
ALTER TABLE IF EXISTS ONLY public.attendance_events DROP CONSTRAINT IF EXISTS attendance_events_pkey;
ALTER TABLE IF EXISTS ONLY public.attendance_events DROP CONSTRAINT IF EXISTS attendance_events_employee_id_request_id_key;
ALTER TABLE IF EXISTS ONLY public.announcements DROP CONSTRAINT IF EXISTS announcements_pkey;
ALTER TABLE IF EXISTS ONLY public.accounts DROP CONSTRAINT IF EXISTS accounts_pkey;
ALTER TABLE IF EXISTS ONLY public.accounts DROP CONSTRAINT IF EXISTS accounts_identifier_key;
ALTER TABLE IF EXISTS public.shifts ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.leave_requests ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.duty_records ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.departments ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.branches ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.audit_log ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.attendance_events ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.announcements ALTER COLUMN id DROP DEFAULT;
ALTER TABLE IF EXISTS public.accounts ALTER COLUMN id DROP DEFAULT;
DROP TABLE IF EXISTS public.system_settings;
DROP SEQUENCE IF EXISTS public.shifts_id_seq;
DROP TABLE IF EXISTS public.shifts;
DROP SEQUENCE IF EXISTS public.leave_requests_id_seq;
DROP TABLE IF EXISTS public.leave_requests;
DROP SEQUENCE IF EXISTS public.duty_records_id_seq;
DROP TABLE IF EXISTS public.duty_records;
DROP SEQUENCE IF EXISTS public.departments_id_seq;
DROP TABLE IF EXISTS public.departments;
DROP SEQUENCE IF EXISTS public.branches_id_seq;
DROP TABLE IF EXISTS public.branches;
DROP TABLE IF EXISTS public.auth_sessions;
DROP SEQUENCE IF EXISTS public.audit_log_id_seq;
DROP TABLE IF EXISTS public.audit_log;
DROP SEQUENCE IF EXISTS public.attendance_events_id_seq;
DROP TABLE IF EXISTS public.attendance_events;
DROP SEQUENCE IF EXISTS public.announcements_id_seq;
DROP TABLE IF EXISTS public.announcements;
DROP SEQUENCE IF EXISTS public.accounts_id_seq;
DROP TABLE IF EXISTS public.accounts;
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
    is_remote boolean DEFAULT false NOT NULL,
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
    is_remote boolean DEFAULT false NOT NULL,
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

COPY public.accounts (id, identifier, name, password_hash, role, branch_id, shift_id, department_id, email, phone, bound_device_id, bound_device_name, device_bound_at, permissions, active, created_at, avatar, is_remote) FROM stdin;
18	009	OSAMA ABID HADI	scrypt:88c537e05779f407d4a4a3900efe3461:ad302e58169c2208112bb27e73cbfb2ac0fe08b3f844eff2967ab92b6efc2a3e4887fc116e697063fb0e1429d704d916d48732e9bbd77749cf9fdb8d752a467b	employee	1	1	\N	osamaabidhadi@gmail.com	\N	a0847912-c1f1-40d9-9f10-446858c74e78	هاتف K	2026-10-22 04:10:15.317-07	{}	t	2026-10-22 04:10:15.255495-07	\N	f
25	016	نائب مدير الموارد البشرية	scrypt:91af59b3418f817248a61102cb3c9c64:622e024ab3238b9d1445cdc21988ee547d7c46bce5940126a2cb3229e6dac5ede8f1711cb0a50c2ec3e999bdffac643139616a52566fac535543f10b33491299	viewer	\N	\N	\N	\N	\N	\N	\N	\N	{employees.read,employees.write,locations.write,qr.manage,shifts.write,reports.export,attendance.edit,leave.review}	t	2026-10-25 01:55:05.431035-07	\N	f
13	006	abdullrahman alradami	scrypt:8fce25a5f3b1c6ada1b21878c014f14d:67a14261e966fee7293c52599e92e1d7a5172649e16e1b0f56ad3b5328fa13ac18a11677286bb79d93d856f8e86203ac86f7599b3c1557a88df9ff71c0ff994d	employee	1	1	\N	abdullrahman.alradami@gmail.com	774714492	ff1144cd-6665-417d-9512-24c9e3cd70c2	آيفون (iOS 18.7)	2026-10-22 02:53:48.451-07	{}	t	2026-10-22 02:53:48.372871-07	data:image/jpeg;base64,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	f
19	010	علاء العامري Alaa Alameire	scrypt:4defb776e377e81f8864dfe053d71c44:1e6e6f5849165dcab8bb9194e8aa82b785bf1a8f08e910be53dd9f4060f56bd65a1b5426cea3d28f8226d45ca6ce19d48f5af84ca8dda6a7702e3253c53f8c8a	employee	1	1	\N	alaa.alameire@gmail.com	\N	f13912e5-3a20-4df9-ad44-9c545b4f7adc	هاتف K	2026-10-22 04:14:35.736-07	{}	t	2026-10-22 04:14:35.652444-07	\N	f
20	011	SHARIF DERHEM	scrypt:05b08c0fe8b79dd594e4b07b134d3059:f7663d2c1bd2b0e9513dd27637abf79765e57add8cbde67d8b47987f4c9c6abf212333f863f4ac6b8f1f0784f841b7f202b594f67d4b12fdedcabdb682afa99f	employee	1	1	\N	sharifderhem@gmail.com	\N	cd232964-c01a-4383-af62-b92249500077	هاتف K	2026-10-22 04:15:54.384-07	{}	t	2026-10-22 04:15:54.290387-07	\N	f
21	012	AMAT AL-FAKHRI	scrypt:0c75b9ed8a5620deae3498d3eb3b780e:6ec2351d6476588a0032d3a03af249ffde2f576b649f0a7438c1f188bcc06ba752952b31d51c54ebb05d7ca76c96b1665584a816395d97ff559614e9fecda325	employee	1	1	\N	amatalfakhri@gmail.com	\N	b274a59f-1be1-43f4-bc74-844f4db5a3f0	آيفون (iOS 18.0)	2026-10-22 05:22:08.270082-07	{}	t	2026-10-22 05:19:58.033835-07	\N	f
1	admin	مدير أساس	scrypt:3eea07cbed599a869a74b4fbcc0afa31:890cf6ae937c78fb1ed2a106fb9c5055ad6a7268819648f317dffa76b47033f7938324c488329e08cd7cf6d95e8c26bad93353e8d97f939f3247ae3864a1f6ce	super_admin	1	1	\N	\N	+967 771234567	\N	\N	\N	{}	t	2026-10-19 00:27:22.407292-07	admin	f
22	013	Abdulghani Ali Ashebami	scrypt:cf72bb80f9bfaa9f3ae87984c43fdd31:dfa0c360b948b65ce25287c5b1f641ea102a2eabbcacc120fba8b1f9a17133224cb289f4f4b94315eefd6cba29f3b307b782f467bd9e6714ce91e7b29032d81f	employee	1	1	\N	samyemen987@gmail.com	\N	f76f1efd-3434-4b23-a574-fd9591895296	هاتف K	2026-10-24 04:47:57.401-07	{}	t	2026-10-24 04:47:57.184681-07	\N	f
24	015	Ammar Obaid	scrypt:ca4433479546a350d342faf5dabe51aa:a6c255544aba11067b65cef1371b73ca74c3d21b6399cff0f4034153416a5b5a2bb1ffa0a73d7750484ef456e151240da9fb21e8ae8a11307b5e8e9ebc724d06	employee	1	1	\N	ammarobaid77212@gmail.com	\N	c57af19c-bf6d-4116-8409-6f817e8903da	هاتف K	2026-10-25 01:22:18.907-07	{}	t	2026-10-25 01:22:18.787442-07	\N	f
23	014	Anas Alaghbari	scrypt:b23d504d0807418a18a42d3e5f351863:6943bd4167293d2646333e5696d5ab2caafda47f4ff0b14a2290ba9ffba8398c25f4790ecbbecec7aa9bf0c91de7d4e19e1ee3f51aa3236617549bc14592e2ae	employee	1	1	\N	anoos.alaghbari@gmail.com	\N	02d8554c-1b0e-4904-b509-61fe916b06f8	هاتف K	2026-10-25 00:44:35.922-07	{audit.read}	t	2026-10-25 00:44:35.803404-07	\N	f
27	018	anas khodayf	scrypt:73779f61ca7bd10667b9693febda204f:303a882527c0d23fd0231bba15a7627bba87e43d1abb88ae95eb44772efec7d87dede3fe2af8783ef5ea1d2bac6d634e279ae7aa687faa37602bb757e72aaa00	employee	1	1	\N	anaskhodayf@gmail.com	\N	07ddcd3b-4747-460d-981c-43c7f10acd62	هاتف K	2026-10-25 03:34:53.677-07	{}	t	2026-10-25 03:34:53.550855-07	\N	t
26	017	ALHassan ALShami	scrypt:36d7345860faa5374019f4c92f6c7df4:d31a1772451a2f7d8445c9dd7416d9fbeba7fd7ab38056c930d169111060060b963ba90fb8a89a9b1cbe20ef34bf0a4aa314d30466aabe099a546c49cfae3ae3	employee	1	1	\N	hassan1alshami6@gmail.com	772765120	f8701b5e-a47e-4248-8dff-22fb37eec485	هاتف K	2026-10-25 02:15:00.965-07	{}	t	2026-10-25 02:15:00.807343-07	data:image/jpeg;base64,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	f
14	004	aliaa.khalil.aldalali	scrypt:024f379a6b91db6bd61da9cfc0551bde:8602ab58eb54d7c6e14a9055e5ef2d0e135d452c55f615e6aa4dfcb11d1b3a61efc4f0729bc5e66a1f5d626a1425c28c01a77715e78e060432f69de7bf4a7388	employee	1	1	\N	aliaa.khalil.aldalai@gmail.com	\N	7fb9f2b1-87f2-4a03-bc2e-415cd0b2d0f3	هاتف K	2026-10-22 03:15:23.279999-07	{}	t	2026-10-22 03:10:38.157764-07	woman	f
28	019	Abdulmajeed Qat	scrypt:9cc2ba545fee81064eda7837f6834296:595a21e3350387de222a4649d9eb24672ac1f0acbda3a0b835ad042f63b2cdb2e418d52fd47ba3893d2a3ec402c3a89c8b719e404b430df76c220b2cf8159c61	employee	1	1	\N	abdulmajeedqat@gmail.com	\N	435061b0-3cb8-4001-9170-14298328169c	هاتف K	2026-10-25 03:40:17.724-07	{}	t	2026-10-25 03:40:17.612072-07	\N	t
29	020	hothifa sadiqmahdi	scrypt:a0d84eef301b2d9856d1062395d6f435:84047459e87aea097a11fd80f6006630b08059862752090f932e1068db7b5736494ec032edae2bfd7e09426eed76784fcaceabc41a16f04c5ab2c80b0f64df6d	employee	1	1	\N	hothifasadiqmahdi@gmail.com	\N	afbb8141-c84b-4f7b-9984-e2967c00fa44	هاتف K	2026-10-25 03:58:08.079-07	{}	t	2026-10-25 03:58:08.008508-07	\N	f
17	008	Emad'adin	scrypt:344c57a89f2d491af7f99c56b3c1b39a:c77b3cdc2fec534ee8e87f850712792ad009983e0eaff000ab31943d01432e4ab002c71c347a2f179d0f61ca567c3ddfc2a2b3d08dfa38532f3014d1159e6cda	employee	1	1	\N	emadadin17@gmail.com	\N	2cc89811-6462-4824-bb83-5a5ec62f14c3	هاتف K	2026-10-22 04:02:29.285-07	{}	t	2026-10-22 04:02:29.178864-07	data:image/jpeg;base64,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	f
11	007	محمود بامطرف	scrypt:e15734de4d388cd479dd97190e477457:59fb5d5eedee2c2f6c321e46fd01073b5f5caa5bfe5fbc17ac671d95e32fe98e8e84fd966ba8d64d83c0ea29e8f5339938efa09388ff834ec2fe958682b7f2f9	employee	1	1	\N	msb701789@gmail.com	\N	7e1c14fe-c24d-4487-bc9e-ddc13703b2b4	هاتف K	2026-10-21 14:20:59.04908-07	{}	t	2026-10-21 13:51:52.955657-07	man	f
\.


--
-- Data for Name: announcements; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.announcements (id, title, content, priority, sender_id, sender_name, send_email, created_at, active) FROM stdin;
2	لا	لال	normal	1	مدير أساس	f	2026-10-20 23:47:41.013433-07	f
3	تعميم  الموارد  البشرية	يوم  غدا  اجزه	normal	1	مدير أساس	f	2026-10-21 00:27:57.300268-07	f
1	مرحباً بكم في نظام أساس المحدث	نرحب بجميع الزملاء والزميلات في التحديث الجديد لنظام أساس مع واجهة عصرية وميزات لحظية.	important	1	مدير أساس	f	2026-10-20 03:01:04.896866-07	f
4	لا	لا	normal	1	مدير أساس	f	2026-10-21 02:47:54.251615-07	f
\.


--
-- Data for Name: attendance_events; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.attendance_events (id, record_id, employee_id, kind, captured_at, received_at, details, request_id) FROM stdin;
1154	16	23	enter	2026-10-25 00:46:00.788-07	2026-10-25 00:46:01.51349-07	{"fix": {"accuracy": 22, "latitude": 15.3061292, "longitude": 44.1982062, "captured_at": "2026-10-25T07:46:00.788Z"}, "is_auto": false, "location": {"state": "inside", "distance": 23.376362385584653}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	986481fa-e819-4e36-b1c0-ba761a4ceab7
1155	11	17	exit	2026-10-25 01:07:19.035-07	2026-10-25 01:07:23.617213-07	{"fix": {"accuracy": 10, "latitude": 15.3063158, "longitude": 44.1981981, "captured_at": "2026-10-25T08:07:19.035Z"}, "is_auto": false, "location": {"state": "inside", "distance": 2.6682122792073755}, "exit_reason": "انتهاء عمل إضافي (+907 دقيقة)", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	3926b398-7ce7-4531-b5a8-d9342391d357
1158	19	26	enter	2026-10-25 02:16:21.214-07	2026-10-25 02:16:22.400497-07	{"fix": {"accuracy": 16, "latitude": 15.3061974, "longitude": 44.1982152, "captured_at": "2026-10-25T09:16:21.214Z"}, "is_auto": false, "location": {"state": "inside", "distance": 12.752539094902916}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3060835, "longitude": 44.1982291, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 110, "exit_delay_seconds": 120}}	1abd5787-ad18-4087-9597-0a7db64e73d5
1170	22	14	scheduled_close	\N	2026-10-25 10:00:19.476564-07	{"effective_at": "2026-10-25T17:00:00.000Z"}	\N
1171	21	28	scheduled_close	\N	2026-10-25 10:00:19.476564-07	{"effective_at": "2026-10-25T17:00:00.000Z"}	\N
1172	20	27	scheduled_close	\N	2026-10-25 10:00:19.476564-07	{"effective_at": "2026-10-25T17:00:00.000Z"}	\N
1156	17	17	enter	2026-10-25 01:07:25.446-07	2026-10-25 01:07:26.422155-07	{"fix": {"accuracy": 8, "latitude": 15.3063198, "longitude": 44.1981987, "captured_at": "2026-10-25T08:07:25.446Z"}, "is_auto": false, "location": {"state": "inside", "distance": 2.219195818622733}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	51bc815c-14f6-488d-87d8-849c7152dcaf
1162	16	23	location	2026-10-25 02:28:01.724-07	2026-10-25 02:28:04.588093-07	{"accuracy": 32, "location": {"state": "outside", "reason": "low_accuracy", "distance": 135.5367679134942}, "revision": 110}	a50d0710-9051-4e38-992b-b1ca8774ccc5
1157	18	24	enter	2026-10-25 01:23:49.44-07	2026-10-25 01:23:55.171709-07	{"fix": {"accuracy": 19, "latitude": 15.3061449, "longitude": 44.1982116, "captured_at": "2026-10-25T08:23:49.440Z"}, "is_auto": false, "location": {"state": "inside", "distance": 21.64894276288531}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	15f7bc41-3673-44ff-a5b5-f2b869dfb5a9
1166	16	23	location	2026-10-25 02:50:04.278-07	2026-10-25 02:50:05.006888-07	{"accuracy": 17, "location": {"state": "inside", "distance": 29.311497415983833}, "revision": 110}	028acda2-f9f5-4a73-9c9d-34b642ed98b6
1167	20	27	enter	2026-10-25 03:37:09.176-07	2026-10-25 03:37:10.200524-07	{"fix": {"accuracy": 17, "latitude": 15.3061473, "longitude": 44.1982373, "captured_at": "2026-10-25T10:37:09.176Z"}, "is_auto": false, "location": {"state": "inside", "distance": 7.148540565267989}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3060835, "longitude": 44.1982291, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 110, "exit_delay_seconds": 120}}	45db0adc-e135-473d-a069-17ef8d80987c
1168	21	28	enter	2026-10-25 03:46:09.438-07	2026-10-25 03:46:10.319862-07	{"fix": {"accuracy": 17, "latitude": 15.3060758, "longitude": 44.1982006, "captured_at": "2026-10-25T10:46:09.438Z"}, "is_auto": false, "location": {"state": "inside", "distance": 3.174298642633049}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3060835, "longitude": 44.1982291, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 110, "exit_delay_seconds": 120}}	854d122f-a499-472b-83ba-d843f1095f01
1169	22	14	enter	2026-10-25 05:19:00.054-07	2026-10-25 05:19:03.454432-07	{"fix": {"accuracy": 20, "latitude": 15.306089, "longitude": 44.1982124, "captured_at": "2026-10-25T12:19:00.054Z"}, "is_auto": false, "location": {"state": "inside", "distance": 1.892621564300344}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3060835, "longitude": 44.1982291, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 110, "exit_delay_seconds": 120}}	5afb081b-a039-4c7b-b50c-b7f60ec1db52
1139	8	17	return	2026-10-22 04:50:31.121-07	2026-10-22 04:50:36.017823-07	{"fix": {"accuracy": 20, "latitude": 15.3063512, "longitude": 44.1982013, "captured_at": "2026-10-22T11:50:31.121Z"}, "is_auto": false, "location": {"state": "inside", "distance": 1.3194871449313355}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	25ed9eba-f9d9-4616-8137-37326b4a28bc
1124	5	13	enter	2026-10-22 02:53:26.334-07	2026-10-22 02:53:53.310383-07	{"fix": {"accuracy": 20, "latitude": 15.306334517470459, "longitude": 44.19791162294377, "captured_at": "2026-10-22T09:53:26.334Z"}, "is_auto": false, "location": {"state": "inside", "distance": 31.959557506923357}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063319, "longitude": 44.1982096, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 105, "exit_delay_seconds": 120}}	73240505-59d0-437c-9db3-75869c4186ca
1125	6	14	enter	2026-10-22 03:15:32.891-07	2026-10-22 03:15:37.723353-07	{"fix": {"accuracy": 27, "latitude": 15.3060473, "longitude": 44.1981665, "captured_at": "2026-10-22T10:15:32.891Z"}, "is_auto": false, "location": {"state": "inside", "distance": 31.98189638565499}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063319, "longitude": 44.1982096, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 105, "exit_delay_seconds": 120}}	488b7234-b83f-4290-825a-9595e080defb
1131	8	17	enter	2026-10-22 04:06:06.628-07	2026-10-22 04:06:08.217445-07	{"fix": {"accuracy": 23, "latitude": 15.3061084, "longitude": 44.1982004, "captured_at": "2026-10-22T11:06:06.628Z"}, "is_auto": false, "location": {"state": "inside", "distance": 26.676027268878673}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063483, "longitude": 44.1982017, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 107, "exit_delay_seconds": 120}}	0369f0a0-1a4d-4bb1-b190-236ede9cc4e5
1132	9	19	enter	2026-10-22 04:16:00.26-07	2026-10-22 04:16:02.08299-07	{"fix": {"accuracy": 22, "latitude": 15.3063234, "longitude": 44.1982107, "captured_at": "2026-10-22T11:16:00.260Z"}, "is_auto": false, "location": {"state": "inside", "distance": 2.9321861626419126}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063483, "longitude": 44.1982017, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 107, "exit_delay_seconds": 120}}	8fc7a3cc-0465-4926-b696-0cf6d7891c62
1133	9	19	exit	2026-10-22 04:16:16.487-07	2026-10-22 04:16:22.512728-07	{"fix": {"accuracy": 15, "latitude": 15.3063506, "longitude": 44.1982109, "captured_at": "2026-10-22T11:16:16.487Z"}, "is_auto": false, "location": {"state": "inside", "distance": 1.0193113868194517}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 104 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063483, "longitude": 44.1982017, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 107, "exit_delay_seconds": 120}}	2dac69dc-6683-42fe-b1f6-2185b40f0b8e
1134	5	13	exit	2026-10-22 04:16:28.227-07	2026-10-22 04:16:30.914007-07	{"fix": {"accuracy": 55, "latitude": 15.306727228135586, "longitude": 44.198017591414484, "captured_at": "2026-10-22T11:16:28.227Z"}, "is_auto": false, "location": {"state": "inside", "reason": "low_accuracy", "distance": 46.53217287061823}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 103 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063483, "longitude": 44.1982017, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 107, "exit_delay_seconds": 120}}	ba6a2a0f-5f17-4541-a8a4-03fbce1287de
1135	5	13	return	2026-10-22 04:16:35.019-07	2026-10-22 04:16:36.374548-07	{"fix": {"accuracy": 13, "latitude": 15.306178811989689, "longitude": 44.19811692585199, "captured_at": "2026-10-22T11:16:35.019Z"}, "is_auto": false, "location": {"state": "inside", "distance": 20.92475874208638}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063483, "longitude": 44.1982017, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 107, "exit_delay_seconds": 120}}	011cd896-c0d6-4908-92b8-836a6ead2147
1136	5	13	exit	2026-10-22 04:16:38.002-07	2026-10-22 04:16:42.576113-07	{"fix": {"accuracy": 13, "latitude": 15.306171159698184, "longitude": 44.19815986438126, "captured_at": "2026-10-22T11:16:38.002Z"}, "is_auto": false, "location": {"state": "inside", "distance": 20.201686115567966}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 103 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063483, "longitude": 44.1982017, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 107, "exit_delay_seconds": 120}}	9c17aef5-0b8a-434c-94bc-07f607c91f7e
1138	8	17	exit	2026-10-22 04:50:31.121-07	2026-10-22 04:50:33.196927-07	{"fix": {"accuracy": 20, "latitude": 15.3063512, "longitude": 44.1982013, "captured_at": "2026-10-22T11:50:31.121Z"}, "is_auto": false, "location": {"state": "inside", "distance": 1.3194871449313355}, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 69 دقيقة", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	f4c32aa4-2e1d-40d5-b6d9-a31bcadf1376
1147	10	22	enter	2026-10-24 04:51:13.712-07	2026-10-24 04:51:15.097109-07	{"fix": {"accuracy": 18, "latitude": 15.3062754, "longitude": 44.1980663, "captured_at": "2026-10-24T11:51:13.712Z"}, "is_auto": false, "location": {"state": "inside", "distance": 16.258471451838965}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	9f5358ed-9f30-4ef6-a1f5-1bf0d7150877
1148	11	17	enter	2026-10-24 05:51:20.567-07	2026-10-24 05:51:23.465443-07	{"fix": {"accuracy": 100, "latitude": 15.3061687, "longitude": 44.1982134, "captured_at": "2026-10-24T12:51:20.567Z"}, "is_auto": false, "location": {"state": "inside", "reason": "low_accuracy", "distance": 19.016283792205126}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	cd6e6250-6cd2-4620-a95d-332557bc4b10
1149	12	11	enter	2026-10-24 05:51:32.995-07	2026-10-24 05:51:35.327467-07	{"fix": {"accuracy": 14, "latitude": 15.3060501, "longitude": 44.1982127, "captured_at": "2026-10-24T12:51:32.995Z"}, "is_auto": false, "location": {"state": "inside", "distance": 32.186925218425706}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	ed986655-88d7-4d2b-9954-fe0b1efc0b94
1150	12	11	auto_exit	2026-10-24 07:34:56.493-07	2026-10-24 07:34:57.715587-07	{"fix": {"accuracy": 100, "latitude": 15.3140253, "longitude": 44.2359058, "captured_at": "2026-10-24T14:34:56.493Z"}, "is_auto": false, "location": {"state": "outside", "reason": "low_accuracy", "distance": 4132.946433888289}, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	107c5b6a-4139-427e-bd44-82845cdd0d51
1151	13	22	enter	2026-10-24 23:06:39.028-07	2026-10-24 23:06:42.447282-07	{"fix": {"accuracy": 17, "latitude": 15.3060274, "longitude": 44.1981897, "captured_at": "2026-10-25T06:06:39.028Z"}, "is_auto": false, "location": {"state": "inside", "distance": 34.72039352496058}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	15a4a69c-8479-4593-a099-9c07f934220e
1152	14	11	enter	2026-10-25 00:42:20.219-07	2026-10-25 00:42:22.909984-07	{"fix": {"accuracy": 24, "latitude": 15.3061308, "longitude": 44.1982036, "captured_at": "2026-10-25T07:42:20.219Z"}, "is_auto": false, "location": {"state": "inside", "distance": 23.195509650711344}, "branch_snapshot": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	2fe514f5-04ec-48e9-9c87-474a74a733cd
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
32	1	account.delete	3	حذف حساب الموظف (عبدو)	{"identifier": "002", "account_name": "عبدو"}	2026-10-20 22:14:44.08333-07
33	1	account.delete	2	حذف حساب الموظف (عبدالغني)	{"identifier": "001", "account_name": "عبدالغني"}	2026-10-20 22:14:49.526554-07
34	1	account.delete	7	حذف حساب الموظف (أحمد الموظف)	{"identifier": "emp1", "account_name": "أحمد الموظف"}	2026-10-20 22:14:55.716784-07
35	1	account.reset_device	8	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "كمبيوتر Windows", "previous_device_id": "bcd162e1-3d54-451a-bc83-1a03fc78a6f9"}	2026-10-20 22:36:06.257448-07
36	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277333639754833, "longitude": 44.22691777253486, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 11, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.306023604211699, "longitude": 44.19817994690613, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 10, "exit_delay_seconds": 120}}	2026-10-20 22:36:38.109046-07
37	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277333639754833, "longitude": 44.22691777253486, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 12, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277333639754833, "longitude": 44.22691777253486, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 11, "exit_delay_seconds": 120}}	2026-10-20 22:36:45.080253-07
38	1	branch.update	1	12	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277333639754833, "longitude": 4.22691777253486, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 13, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277333639754833, "longitude": 44.22691777253486, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 12, "exit_delay_seconds": 120}}	2026-10-20 22:40:22.341756-07
39	1	attendance.edit	4	1	{"after": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T05:39:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T05:39:36.681Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 6, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}, "before": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:03.254Z", "last_out": "2026-10-21T05:39:30.291Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T05:39:36.681Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 800 دقيقة", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 6, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}}	2026-10-20 22:42:34.524743-07
40	1	attendance.edit	4	1	{"after": {"id": "4", "state": "outside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T05:39:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T05:39:36.681Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 6, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}, "before": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T05:39:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T05:39:36.681Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 6, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}}	2026-10-20 22:46:04.292166-07
41	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277320476908827, "longitude": 44.226971078699634, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 14, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277333639754833, "longitude": 4.22691777253486, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 13, "exit_delay_seconds": 120}}	2026-10-20 22:46:48.965422-07
42	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277320476908827, "longitude": 4.226971078699634, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 15, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277320476908827, "longitude": 44.226971078699634, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 14, "exit_delay_seconds": 120}}	2026-10-20 22:47:17.250547-07
43	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277268065894168, "longitude": 44.22711552402454, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 16, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277320476908827, "longitude": 4.226971078699634, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 15, "exit_delay_seconds": 120}}	2026-10-20 22:50:42.013556-07
44	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277268065894168, "longitude": 4.22711552402454, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 17, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277268065894168, "longitude": 44.22711552402454, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 16, "exit_delay_seconds": 120}}	2026-10-20 22:51:48.108804-07
45	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277362174411936, "longitude": 44.226868420644024, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 18, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277268065894168, "longitude": 4.22711552402454, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 17, "exit_delay_seconds": 120}}	2026-10-20 22:53:21.559003-07
46	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277362174411936, "longitude": 4.226868420644024, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 19, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277362174411936, "longitude": 44.226868420644024, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 18, "exit_delay_seconds": 120}}	2026-10-20 22:53:57.136509-07
47	1	attendance.edit	4	1	{"after": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T05:51:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T05:53:37.246Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 144, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}, "before": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T05:51:41.203Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T05:53:37.246Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 788 دقيقة", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 144, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}}	2026-10-20 22:56:29.900083-07
48	1	attendance.edit	4	1	{"after": {"id": "4", "state": "outside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T05:51:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T05:53:37.246Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 144, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}, "before": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T05:51:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T05:53:37.246Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 144, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}}	2026-10-20 22:56:47.706935-07
49	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277390955513907, "longitude": 44.22680376772608, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 20, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277362174411936, "longitude": 4.226868420644024, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 19, "exit_delay_seconds": 120}}	2026-10-20 22:57:03.151726-07
50	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277390955513907, "longitude": 4.22680376772608, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 21, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277390955513907, "longitude": 44.22680376772608, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 20, "exit_delay_seconds": 120}}	2026-10-20 22:57:52.156798-07
51	1	attendance.edit	4	1	{"after": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T05:51:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T05:57:14.865Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 144, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}, "before": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T05:51:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T05:57:14.865Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 144, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}}	2026-10-20 22:58:32.31206-07
52	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277300494457208, "longitude": 44.22694059520813, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 22, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277390955513907, "longitude": 4.22680376772608, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 21, "exit_delay_seconds": 120}}	2026-10-20 23:12:09.019696-07
53	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277344063677992, "longitude": 44.226884366918625, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 23, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277300494457208, "longitude": 44.22694059520813, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 22, "exit_delay_seconds": 120}}	2026-10-20 23:24:55.132789-07
54	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277300494457208, "longitude": 4.22694059520813, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 24, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277344063677992, "longitude": 44.226884366918625, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 23, "exit_delay_seconds": 120}}	2026-10-20 23:25:03.763999-07
55	1	attendance.edit	4	1	{"after": {"id": "4", "state": "outside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T06:12:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T06:23:14.098Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 789, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}, "before": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T06:12:38.501Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T06:23:14.098Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 767 دقيقة", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 789, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}}	2026-10-20 23:25:50.251459-07
56	1	attendance.edit	4	1	{"after": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T06:12:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T06:23:14.098Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 789, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}, "before": {"id": "4", "state": "outside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T06:12:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T06:23:14.098Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 789, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}}	2026-10-20 23:26:02.176113-07
57	1	attendance.edit	4	1	{"after": {"id": "4", "state": "closed", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T06:12:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T06:23:14.098Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 789, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}, "before": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T06:12:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T06:23:14.098Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 789, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}}	2026-10-20 23:28:10.422572-07
58	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27733309009082, "longitude": 44.22685440071091, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 25, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277300494457208, "longitude": 4.22694059520813, "exit_radius": 120, "qr_revision": 2, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 24, "exit_delay_seconds": 120}}	2026-10-20 23:37:42.703319-07
59	1	attendance.edit	4	1	{"after": {"id": "4", "state": "inside", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T06:12:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T06:23:14.098Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 789, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}, "before": {"id": "4", "state": "closed", "first_in": "2026-10-21T05:37:00.000Z", "last_out": "2026-10-21T06:12:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-21T06:23:14.098Z", "shift_end": "2026-10-21T19:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-21T05:00:00.000Z", "away_seconds": 789, "away_started": null, "close_policy": "actual_exit", "late_minutes": 22, "exit_candidate": null}}	2026-10-20 23:38:30.486871-07
60	1	announcement.create	2	لا	{}	2026-10-20 23:47:41.013433-07
61	1	account.reset_device	8	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "هاتف K", "previous_device_id": "02d8554c-1b0e-4904-b509-61fe916b06f8"}	2026-10-20 23:56:44.518681-07
62	1	announcement.create	3	تعميم  الموارد  البشرية	{}	2026-10-21 00:27:57.300268-07
63	1	reports.export	attendance	تصدير Word	{"count": 1}	2026-10-21 00:41:24.027489-07
64	1	account.reset_device	8	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "كمبيوتر Windows", "previous_device_id": "bcd162e1-3d54-451a-bc83-1a03fc78a6f9"}	2026-10-21 01:01:32.908862-07
65	1	qr.revoke	1	للتفعيبل	{}	2026-10-21 01:04:00.330401-07
66	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27733309009082, "longitude": 4.22685440071091, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 26, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27733309009082, "longitude": 44.22685440071091, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 25, "exit_delay_seconds": 120}}	2026-10-21 01:07:03.821191-07
67	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277380772137217, "longitude": 44.22677292862562, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 27, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27733309009082, "longitude": 4.22685440071091, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 26, "exit_delay_seconds": 120}}	2026-10-21 01:09:49.311319-07
68	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277380772137217, "longitude": 44.22677292862562, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 28, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277380772137217, "longitude": 44.22677292862562, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 27, "exit_delay_seconds": 120}}	2026-10-21 01:09:49.328436-07
69	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277380772137217, "longitude": 4.22677292862562, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 29, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277380772137217, "longitude": 44.22677292862562, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 28, "exit_delay_seconds": 120}}	2026-10-21 01:10:23.663778-07
70	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27737091126966, "longitude": 44.226817305700855, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 30, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277380772137217, "longitude": 4.22677292862562, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 29, "exit_delay_seconds": 120}}	2026-10-21 01:12:52.891249-07
71	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27737830779674, "longitude": 44.22681714832794, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 31, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27737091126966, "longitude": 44.226817305700855, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 30, "exit_delay_seconds": 120}}	2026-10-21 01:16:23.83383-07
72	1	shift.update	1	1	{"policy_snapshot": "Existing duty records unchanged"}	2026-10-21 01:19:10.248129-07
73	1	shift.create	2	إنشاء جدول	{}	2026-10-21 01:19:50.01527-07
74	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27737830779674, "longitude": 4.22681714832794, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 32, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27737830779674, "longitude": 44.22681714832794, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 31, "exit_delay_seconds": 120}}	2026-10-21 01:20:55.810593-07
75	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27735733964773, "longitude": 44.226860811938266, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 33, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27737830779674, "longitude": 4.22681714832794, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 32, "exit_delay_seconds": 120}}	2026-10-21 01:23:20.476143-07
76	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27735733964773, "longitude": 44.226860811938266, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 34, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27735733964773, "longitude": 44.226860811938266, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 33, "exit_delay_seconds": 120}}	2026-10-21 01:23:22.008999-07
77	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27735733964773, "longitude": 4.226860811938266, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 35, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27735733964773, "longitude": 44.226860811938266, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 34, "exit_delay_seconds": 120}}	2026-10-21 01:23:50.374847-07
78	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277291720688247, "longitude": 44.227069517135014, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 36, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27735733964773, "longitude": 4.226860811938266, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 35, "exit_delay_seconds": 120}}	2026-10-21 01:26:13.194278-07
79	1	account.reset_device	8	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "هاتف K", "previous_device_id": "02d8554c-1b0e-4904-b509-61fe916b06f8"}	2026-10-21 01:32:26.040993-07
80	1	account.reset_device	8	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "كمبيوتر Windows", "previous_device_id": "bcd162e1-3d54-451a-bc83-1a03fc78a6f9"}	2026-10-21 01:33:49.318921-07
81	1	leave.review	1	بموافقة  المدير	{"status": "approved"}	2026-10-21 01:37:44.788192-07
82	1	reports.export	attendance	تصدير CSV	{"count": 1}	2026-10-21 01:42:38.867717-07
83	1	account.delete	9	حذف حساب الموظف (Abdulghani Ali Ashebami)	{"identifier": "004", "account_name": "Abdulghani Ali Ashebami"}	2026-10-21 02:05:37.068609-07
84	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277291720688247, "longitude": 4.227069517135014, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 37, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277291720688247, "longitude": 44.227069517135014, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 36, "exit_delay_seconds": 120}}	2026-10-21 02:06:22.888627-07
85	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277352361887319, "longitude": 44.22686992846712, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 38, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277291720688247, "longitude": 4.227069517135014, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 37, "exit_delay_seconds": 120}}	2026-10-21 02:21:34.809828-07
86	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277352361887319, "longitude": 44.22686992846712, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 39, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277352361887319, "longitude": 44.22686992846712, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 38, "exit_delay_seconds": 120}}	2026-10-21 02:21:37.905841-07
87	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277352361887319, "longitude": 4.22686992846712, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 40, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277352361887319, "longitude": 44.22686992846712, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 39, "exit_delay_seconds": 120}}	2026-10-21 02:21:47.905615-07
88	1	account.reset_device	8	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "هاتف Pixel 10", "previous_device_id": "bcd162e1-3d54-451a-bc83-1a03fc78a6f9"}	2026-10-21 02:27:54.924447-07
89	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27737556720456, "longitude": 44.22687395639466, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 41, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277352361887319, "longitude": 4.22686992846712, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 40, "exit_delay_seconds": 120}}	2026-10-21 02:28:40.553415-07
90	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27737556720456, "longitude": 4.22687395639466, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 42, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27737556720456, "longitude": 44.22687395639466, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 41, "exit_delay_seconds": 120}}	2026-10-21 02:30:28.347449-07
91	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277335265216815, "longitude": 44.226910348953304, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 43, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.27737556720456, "longitude": 4.22687395639466, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 42, "exit_delay_seconds": 120}}	2026-10-21 02:32:54.322221-07
93	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277261526534776, "longitude": 44.2271645827838, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 45, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277335265216815, "longitude": 2.2269103489533, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 44, "exit_delay_seconds": 120}}	2026-10-21 02:35:58.197182-07
94	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277261526534776, "longitude": 3.2271645827838, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 46, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277261526534776, "longitude": 44.2271645827838, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 45, "exit_delay_seconds": 120}}	2026-10-21 02:36:18.24491-07
92	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277335265216815, "longitude": 2.2269103489533, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 44, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277335265216815, "longitude": 44.226910348953304, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 43, "exit_delay_seconds": 120}}	2026-10-21 02:33:22.830386-07
95	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277322261005661, "longitude": 44.226944705754775, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 47, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277261526534776, "longitude": 3.2271645827838, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 46, "exit_delay_seconds": 120}}	2026-10-21 02:41:40.290792-07
96	1	branch.update	1	10	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277322261005661, "longitude": 4.226944705754775, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 48, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277322261005661, "longitude": 44.226944705754775, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 47, "exit_delay_seconds": 120}}	2026-10-21 02:41:57.426233-07
97	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277287957488342, "longitude": 44.22693738508723, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 49, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277322261005661, "longitude": 4.226944705754775, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 48, "exit_delay_seconds": 120}}	2026-10-21 02:44:18.459297-07
98	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277330828134579, "longitude": 44.22683819304048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 50, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277287957488342, "longitude": 44.22693738508723, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 49, "exit_delay_seconds": 120}}	2026-10-21 02:45:55.182978-07
99	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 5.277330828134579, "longitude": 4.22683819304048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 51, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277330828134579, "longitude": 44.22683819304048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 50, "exit_delay_seconds": 120}}	2026-10-21 02:46:10.450383-07
100	1	announcement.create	4	لا	{}	2026-10-21 02:47:54.251615-07
101	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277325867970196, "longitude": 44.22694657821099, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 52, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 5.277330828134579, "longitude": 4.22683819304048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 51, "exit_delay_seconds": 120}}	2026-10-21 02:48:46.046135-07
102	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277325867970196, "longitude": 4.22694657821099, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 53, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277325867970196, "longitude": 44.22694657821099, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 52, "exit_delay_seconds": 120}}	2026-10-21 02:49:08.938452-07
103	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277320258383895, "longitude": 44.22696097221577, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 54, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277325867970196, "longitude": 4.22694657821099, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 53, "exit_delay_seconds": 120}}	2026-10-21 03:04:57.258684-07
104	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277320258383895, "longitude": 2.22696097221577, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 55, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277320258383895, "longitude": 44.22696097221577, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 54, "exit_delay_seconds": 120}}	2026-10-21 03:05:35.283302-07
105	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277355665274921, "longitude": 44.22695006148371, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 56, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277320258383895, "longitude": 2.22696097221577, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 55, "exit_delay_seconds": 120}}	2026-10-21 04:04:57.968344-07
106	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277355665274921, "longitude": 4.22695006148371, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 57, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277355665274921, "longitude": 44.22695006148371, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 56, "exit_delay_seconds": 120}}	2026-10-21 04:15:17.830629-07
107	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277453235417362, "longitude": 44.2268660854004, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 58, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277355665274921, "longitude": 4.22695006148371, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 57, "exit_delay_seconds": 120}}	2026-10-21 04:17:44.616909-07
108	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277453235417362, "longitude": 4.2268660854004, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 59, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277453235417362, "longitude": 44.2268660854004, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 58, "exit_delay_seconds": 120}}	2026-10-21 04:18:17.700431-07
109	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277453235417362, "longitude": 44.2268660854004, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 60, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277453235417362, "longitude": 4.2268660854004, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 59, "exit_delay_seconds": 120}}	2026-10-21 04:18:28.027079-07
110	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277453235417362, "longitude": 44.2268660854004, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 61, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277453235417362, "longitude": 44.2268660854004, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 60, "exit_delay_seconds": 120}}	2026-10-21 04:18:34.303465-07
111	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277336955912212, "longitude": 44.22696930401479, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 62, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277453235417362, "longitude": 44.2268660854004, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 61, "exit_delay_seconds": 120}}	2026-10-21 04:19:22.876574-07
112	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277336955912212, "longitude": 4.22696930401479, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 63, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277336955912212, "longitude": 44.22696930401479, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 62, "exit_delay_seconds": 120}}	2026-10-21 04:19:35.868044-07
113	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277170737913341, "longitude": 44.22712330083656, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 64, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277336955912212, "longitude": 4.22696930401479, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 63, "exit_delay_seconds": 120}}	2026-10-21 04:24:27.90534-07
116	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277219851630678, "longitude": 4.22707122797971, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 67, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277219851630678, "longitude": 44.22707122797971, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 66, "exit_delay_seconds": 120}}	2026-10-21 04:26:17.975608-07
114	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277170737913341, "longitude": 44.22712330083656, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 65, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277170737913341, "longitude": 44.22712330083656, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 64, "exit_delay_seconds": 120}}	2026-10-21 04:24:27.910778-07
115	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277219851630678, "longitude": 44.22707122797971, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 66, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277170737913341, "longitude": 44.22712330083656, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 65, "exit_delay_seconds": 120}}	2026-10-21 04:25:43.675357-07
117	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277365829790384, "longitude": 44.226877596736365, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 68, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277219851630678, "longitude": 4.22707122797971, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 67, "exit_delay_seconds": 120}}	2026-10-21 04:28:46.111156-07
118	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277365829790384, "longitude": 4.226877596736365, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 69, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277365829790384, "longitude": 44.226877596736365, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 68, "exit_delay_seconds": 120}}	2026-10-21 04:29:20.22854-07
119	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277392653706752, "longitude": 44.226936188774715, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 70, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277365829790384, "longitude": 4.226877596736365, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 69, "exit_delay_seconds": 120}}	2026-10-21 04:32:23.843468-07
120	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277392653706752, "longitude": 4.226936188774715, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 71, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277392653706752, "longitude": 44.226936188774715, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 70, "exit_delay_seconds": 120}}	2026-10-21 04:33:44.443166-07
121	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277211124312165, "longitude": 44.227145099476346, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 72, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277392653706752, "longitude": 4.226936188774715, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 71, "exit_delay_seconds": 120}}	2026-10-21 04:38:18.400696-07
122	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277211124312165, "longitude": 4.227145099476346, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 73, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277211124312165, "longitude": 44.227145099476346, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 72, "exit_delay_seconds": 120}}	2026-10-21 04:39:24.151223-07
123	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277290147685312, "longitude": 44.226982605135696, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 74, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277211124312165, "longitude": 4.227145099476346, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 73, "exit_delay_seconds": 120}}	2026-10-21 04:39:47.22342-07
124	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277290147685312, "longitude": 4.226982605135696, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 75, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277290147685312, "longitude": 44.226982605135696, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 74, "exit_delay_seconds": 120}}	2026-10-21 04:40:09.181988-07
125	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 44.22680849009048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 76, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277290147685312, "longitude": 4.226982605135696, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 75, "exit_delay_seconds": 120}}	2026-10-21 04:42:28.597511-07
126	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 44.22680849009048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 77, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 44.22680849009048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 76, "exit_delay_seconds": 120}}	2026-10-21 04:42:57.221006-07
128	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 44.22680849009048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 79, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 4.22680849009048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 78, "exit_delay_seconds": 120}}	2026-10-21 04:43:22.322265-07
127	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 4.22680849009048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 78, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 44.22680849009048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 77, "exit_delay_seconds": 120}}	2026-10-21 04:43:05.531594-07
129	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 44.22680849009, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 80, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 44.22680849009048, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 79, "exit_delay_seconds": 120}}	2026-10-21 04:43:38.757828-07
130	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 44.2680849009, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 81, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 44.22680849009, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 80, "exit_delay_seconds": 120}}	2026-10-21 04:43:52.931041-07
131	1	announcement.delete	4	لا	{}	2026-10-21 04:45:54.133214-07
132	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277335265216815, "longitude": 44.226910348953304, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 82, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277411723136932, "longitude": 44.2680849009, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 81, "exit_delay_seconds": 120}}	2026-10-21 04:46:17.87073-07
133	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277335265216815, "longitude": 3.2269103489533, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 83, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277335265216815, "longitude": 44.226910348953304, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 82, "exit_delay_seconds": 120}}	2026-10-21 04:46:42.023065-07
134	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277302166275794, "longitude": 44.22702249202626, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 84, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277335265216815, "longitude": 3.2269103489533, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 83, "exit_delay_seconds": 120}}	2026-10-21 04:49:33.849342-07
135	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277302166275794, "longitude": 4.22702249202626, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 85, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277302166275794, "longitude": 44.22702249202626, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 84, "exit_delay_seconds": 120}}	2026-10-21 04:49:52.216576-07
136	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277370420388772, "longitude": 44.22685265382405, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 86, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277302166275794, "longitude": 4.22702249202626, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 85, "exit_delay_seconds": 120}}	2026-10-21 04:53:16.135958-07
137	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277370420388772, "longitude": 4.22685265382405, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 87, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277370420388772, "longitude": 44.22685265382405, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 86, "exit_delay_seconds": 120}}	2026-10-21 04:53:52.590875-07
138	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277366494452863, "longitude": 44.22681628210327, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 88, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277370420388772, "longitude": 4.22685265382405, "exit_radius": 120, "qr_revision": 3, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 87, "exit_delay_seconds": 120}}	2026-10-21 04:55:04.151532-07
139	1	qr.revoke	1	1	{}	2026-10-21 04:59:42.265747-07
140	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277386672497686, "longitude": 44.22681612335271, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 89, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277366494452863, "longitude": 44.22681628210327, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 88, "exit_delay_seconds": 120}}	2026-10-21 05:00:53.256596-07
141	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277366494452863, "longitude": 4.22681628210327, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 90, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277386672497686, "longitude": 44.22681612335271, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 89, "exit_delay_seconds": 120}}	2026-10-21 05:01:02.327675-07
142	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277325962280385, "longitude": 44.22678498796436, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 91, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277366494452863, "longitude": 4.22681628210327, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 90, "exit_delay_seconds": 120}}	2026-10-21 05:04:46.529642-07
143	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277325962280385, "longitude": 44.22678498796436, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 92, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277325962280385, "longitude": 44.22678498796436, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 91, "exit_delay_seconds": 120}}	2026-10-21 05:04:48.579613-07
144	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277325962280385, "longitude": 4.22678498796436, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 93, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277325962280385, "longitude": 44.22678498796436, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 92, "exit_delay_seconds": 120}}	2026-10-21 05:11:30.352082-07
145	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277329569149286, "longitude": 44.226939718705964, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 94, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277325962280385, "longitude": 4.22678498796436, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 93, "exit_delay_seconds": 120}}	2026-10-21 05:12:12.074002-07
146	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277329569149286, "longitude": 4.226939718705964, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 95, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277329569149286, "longitude": 44.226939718705964, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 94, "exit_delay_seconds": 120}}	2026-10-21 05:12:51.430972-07
147	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277386660327654, "longitude": 44.226892684390705, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 96, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277329569149286, "longitude": 4.226939718705964, "exit_radius": 120, "qr_revision": 4, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 95, "exit_delay_seconds": 120}}	2026-10-21 05:13:26.470315-07
148	1	qr.revoke	1	1	{}	2026-10-21 05:13:59.254389-07
149	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277386660327654, "longitude": 4.226892684390705, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 97, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277386660327654, "longitude": 44.226892684390705, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 96, "exit_delay_seconds": 120}}	2026-10-21 05:15:06.199627-07
150	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277305708313705, "longitude": 44.22690880681818, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 98, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277386660327654, "longitude": 4.226892684390705, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 97, "exit_delay_seconds": 120}}	2026-10-21 05:17:28.967377-07
151	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277305708313705, "longitude": 44.22690880681818, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 99, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277305708313705, "longitude": 44.22690880681818, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 98, "exit_delay_seconds": 120}}	2026-10-21 05:17:29.261011-07
152	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277305708313705, "longitude": 4.22690880681818, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 100, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277305708313705, "longitude": 44.22690880681818, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 99, "exit_delay_seconds": 120}}	2026-10-21 05:19:38.31573-07
153	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277301299874729, "longitude": 44.22692786022509, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 101, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277305708313705, "longitude": 4.22690880681818, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 100, "exit_delay_seconds": 120}}	2026-10-21 05:20:15.504849-07
154	1	branch.update	1	6	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277301299874729, "longitude": 4.22692786022509, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 102, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277301299874729, "longitude": 44.22692786022509, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 101, "exit_delay_seconds": 120}}	2026-10-21 05:21:02.519634-07
155	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.2772116, "longitude": 44.2268693, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 103, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.277301299874729, "longitude": 4.22692786022509, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 102, "exit_delay_seconds": 120}}	2026-10-21 05:50:58.965486-07
156	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.2783892, "longitude": 44.2378606, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 104, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.2772116, "longitude": 44.2268693, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 103, "exit_delay_seconds": 120}}	2026-10-21 13:37:04.657814-07
157	1	account.create	12	إضافة حساب	{}	2026-10-21 14:05:04.932583-07
158	1	account.reset_device	11	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "هاتف K", "previous_device_id": "7e1c14fe-c24d-4487-bc9e-ddc13703b2b4"}	2026-10-21 14:10:16.19247-07
159	1	account.reset_device	12	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "هاتف K", "previous_device_id": "7e1c14fe-c24d-4487-bc9e-ddc13703b2b4"}	2026-10-21 14:20:14.639023-07
160	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063319, "longitude": 44.1982096, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 105, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.2783892, "longitude": 44.2378606, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 104, "exit_delay_seconds": 120}}	2026-10-22 02:46:30.386675-07
161	1	account.delete	12	حذف حساب الموظف (نائب موارد البشرية)	{"identifier": "005", "account_name": "نائب موارد البشرية"}	2026-10-22 03:06:43.289109-07
162	1	account.update	14	1	{"email": "aliaa.khalil.aldalai@gmail.com", "phone": null, "active": true, "shift_id": 1, "branch_id": 1, "permissions": [], "password_changed": true}	2026-10-22 03:14:33.539381-07
163	1	account.reset_device	14	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "كمبيوتر Windows", "previous_device_id": "2a9898b1-ffbb-4691-a172-87d5a63c2f03"}	2026-10-22 03:14:47.144564-07
164	1	account.approve	16	اعتماد تجريبي فوري	{"role": "employee", "shift_id": 1, "branch_id": 1, "previous_active": false}	2026-10-22 03:28:45.639874-07
165	1	attendance.edit	7	1	{"after": {"id": "7", "state": "inside", "first_in": "2026-10-22T10:44:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T10:44:33.641Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 329, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T10:44:33.217Z", "revision": 105, "last_received": "2026-10-22T10:44:33.641Z"}}, "before": {"id": "7", "state": "inside", "first_in": "2026-10-22T10:44:15.944Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T10:44:33.641Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": null, "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 329, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T10:44:33.217Z", "revision": 105, "last_received": "2026-10-22T10:44:33.641Z"}}}	2026-10-22 03:58:57.174344-07
166	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063319, "longitude": 4.1982096, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 106, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063319, "longitude": 44.1982096, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 105, "exit_delay_seconds": 120}}	2026-10-22 04:00:09.336122-07
167	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063483, "longitude": 44.1982017, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 107, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063319, "longitude": 4.1982096, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 106, "exit_delay_seconds": 120}}	2026-10-22 04:01:33.136323-07
168	1	account.update	17	1	{"email": "emadadin17@gmail.com", "phone": null, "active": true, "shift_id": 1, "branch_id": 1, "permissions": [], "password_changed": false}	2026-10-22 04:03:48.633277-07
169	1	account.approve	18	اعتماد وقبول الحساب من لوحة التحكم	{"role": "employee", "shift_id": 1, "branch_id": 1, "previous_active": false}	2026-10-22 04:10:29.141212-07
170	1	account.approve	19	اعتماد وقبول الحساب من لوحة التحكم	{"role": "employee", "shift_id": 1, "branch_id": 1, "previous_active": false}	2026-10-22 04:14:43.440204-07
171	1	account.approve	20	اعتماد وقبول الحساب من لوحة التحكم	{"role": "employee", "shift_id": 1, "branch_id": 1, "previous_active": false}	2026-10-22 04:16:17.055057-07
172	1	branch.update	1	1	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063483, "longitude": 4.198201, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 108, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063483, "longitude": 44.1982017, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 107, "exit_delay_seconds": 120}}	2026-10-22 04:20:00.868708-07
173	1	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063483, "longitude": 4.198201, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 108, "exit_delay_seconds": 120}}	2026-10-22 04:22:53.039337-07
174	1	reports.export	attendance	تصدير Word	{"count": 5}	2026-10-22 04:23:15.909565-07
175	1	reports.export	attendance	تصدير Word	{"count": 5}	2026-10-22 04:24:10.892944-07
176	1	reports.export	attendance	تصدير CSV	{"count": 5}	2026-10-22 04:24:26.757465-07
177	1	account.approve	21	اعتماد وقبول الحساب من لوحة التحكم	{"role": "employee", "shift_id": 1, "branch_id": 1, "previous_active": false}	2026-10-22 05:20:41.556999-07
178	1	account.reset_device	21	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "كمبيوتر Windows", "previous_device_id": "a9a972c9-f1cf-454b-9f4b-c1989188a676"}	2026-10-22 05:21:40.660726-07
179	1	reports.export	attendance	تصدير TXT	{"count": 5}	2026-10-22 05:23:25.384429-07
180	1	attendance.edit	7	1	{"after": {"id": "7", "state": "inside", "first_in": "2026-10-22T10:44:00.000Z", "last_out": "2026-10-22T12:28:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T12:28:59.330Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 2059, "away_started": null, "close_policy": "actual_exit", "late_minutes": 329, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T12:28:57.274Z", "revision": 109, "last_received": "2026-10-22T12:28:59.330Z"}}, "before": {"id": "7", "state": "inside", "first_in": "2026-10-22T10:44:00.000Z", "last_out": "2026-10-22T12:28:39.558Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T12:28:59.330Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 8, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 31 دقيقة", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 2059, "away_started": null, "close_policy": "actual_exit", "late_minutes": 329, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T12:28:57.274Z", "revision": 109, "last_received": "2026-10-22T12:28:59.330Z"}}}	2026-10-22 05:30:01.8195-07
181	1	attendance.edit	6	1	{"after": {"id": "6", "state": "inside", "first_in": "2026-10-22T10:15:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T10:23:21.202Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 14, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 300, "exit_candidate": null}, "before": {"id": "6", "state": "inside", "first_in": "2026-10-22T10:15:37.724Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T10:23:21.202Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 14, "exit_reason": null, "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 300, "exit_candidate": null}}	2026-10-22 05:36:04.945557-07
182	1	reports.export	attendance	تصدير TXT	{"count": 5}	2026-10-22 05:48:47.599551-07
183	1	attendance.edit	8	1	{"after": {"id": "8", "state": "inside", "first_in": "2026-10-22T11:06:00.000Z", "last_out": "2026-10-22T11:50:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T12:24:59.862Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 2, "away_started": null, "close_policy": "actual_exit", "late_minutes": 351, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T12:24:58.670Z", "revision": 109, "last_received": "2026-10-22T12:24:59.862Z"}}, "before": {"id": "8", "state": "inside", "first_in": "2026-10-22T11:06:08.218Z", "last_out": "2026-10-22T11:50:33.198Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T12:24:59.862Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": "خروج مبكر قبل نهاية الدوام بـ 69 دقيقة", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 2, "away_started": null, "close_policy": "actual_exit", "late_minutes": 351, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T12:24:58.670Z", "revision": 109, "last_received": "2026-10-22T12:24:59.862Z"}}}	2026-10-22 05:59:09.110868-07
184	1	reports.export	attendance	تصدير TXT	{"count": 9}	2026-10-22 06:01:22.081613-07
185	1	attendance.edit	8	1	{"after": {"id": "8", "state": "outside", "first_in": "2026-10-22T11:06:00.000Z", "last_out": "2026-10-22T11:50:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T12:24:59.862Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 2, "away_started": null, "close_policy": "actual_exit", "late_minutes": 351, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T12:24:58.670Z", "revision": 109, "last_received": "2026-10-22T12:24:59.862Z"}}, "before": {"id": "8", "state": "inside", "first_in": "2026-10-22T11:06:00.000Z", "last_out": "2026-10-22T11:50:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T12:24:59.862Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 2, "away_started": null, "close_policy": "actual_exit", "late_minutes": 351, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T12:24:58.670Z", "revision": 109, "last_received": "2026-10-22T12:24:59.862Z"}}}	2026-10-22 06:45:21.021496-07
186	1	attendance.edit	6	1	{"after": {"id": "6", "state": "outside", "first_in": "2026-10-22T10:15:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T10:23:21.202Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 14, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 300, "exit_candidate": null}, "before": {"id": "6", "state": "inside", "first_in": "2026-10-22T10:15:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T10:23:21.202Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 14, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 300, "exit_candidate": null}}	2026-10-22 06:45:53.547785-07
187	1	attendance.edit	8	1	{"after": {"id": "8", "state": "inside", "first_in": "2026-10-22T11:06:00.000Z", "last_out": "2026-10-22T11:50:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T12:24:59.862Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 2, "away_started": null, "close_policy": "actual_exit", "late_minutes": 351, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T12:24:58.670Z", "revision": 109, "last_received": "2026-10-22T12:24:59.862Z"}}, "before": {"id": "8", "state": "outside", "first_in": "2026-10-22T11:06:00.000Z", "last_out": "2026-10-22T11:50:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T12:24:59.862Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 2, "away_started": null, "close_policy": "actual_exit", "late_minutes": 351, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T12:24:58.670Z", "revision": 109, "last_received": "2026-10-22T12:24:59.862Z"}}}	2026-10-22 06:47:13.237012-07
188	1	attendance.edit	6	1	{"after": {"id": "6", "state": "inside", "first_in": "2026-10-22T10:15:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T10:23:21.202Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 14, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 300, "exit_candidate": null}, "before": {"id": "6", "state": "outside", "first_in": "2026-10-22T10:15:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T10:23:21.202Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 14, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 300, "exit_candidate": null}}	2026-10-22 06:47:31.157378-07
189	1	attendance.edit	6	1	{"after": {"id": "6", "state": "outside", "first_in": "2026-10-22T10:15:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T10:23:21.202Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 14, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 300, "exit_candidate": null}, "before": {"id": "6", "state": "inside", "first_in": "2026-10-22T10:15:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T10:23:21.202Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 14, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 300, "exit_candidate": null}}	2026-10-22 14:44:55.175646-07
190	1	attendance.edit	8	1	{"after": {"id": "8", "state": "outside", "first_in": "2026-10-22T11:06:00.000Z", "last_out": "2026-10-22T11:50:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T12:24:59.862Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 2, "away_started": null, "close_policy": "actual_exit", "late_minutes": 351, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T12:24:58.670Z", "revision": 109, "last_received": "2026-10-22T12:24:59.862Z"}}, "before": {"id": "8", "state": "inside", "first_in": "2026-10-22T11:06:00.000Z", "last_out": "2026-10-22T11:50:00.000Z", "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-22T12:24:59.862Z", "shift_end": "2026-10-22T13:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-22T05:00:00.000Z", "away_seconds": 2, "away_started": null, "close_policy": "actual_exit", "late_minutes": 351, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-22T12:24:58.670Z", "revision": 109, "last_received": "2026-10-22T12:24:59.862Z"}}}	2026-10-22 14:45:02.752796-07
191	1	reports.export	employee_dossier	تصدير TXT لسجل موظف	{"count": 1, "employee_id": 8}	2026-10-24 04:24:16.553882-07
192	1	reports.export	employee_dossier	تصدير TXT لسجل موظف	{"count": 3, "employee_id": 17}	2026-10-24 04:26:20.178003-07
193	1	reports.export	collective_summary	تصدير TXT للتقرير الجماعي	{"count": 9}	2026-10-24 04:26:52.27205-07
194	1	reports.export	collective_summary	تصدير Word للتقرير الجماعي	{"count": 9}	2026-10-24 04:27:22.66698-07
195	1	reports.export	collective_summary	تصدير CSV للتقرير الجماعي	{"count": 9}	2026-10-24 04:27:38.362978-07
196	1	reports.export	collective_summary	تصدير TXT للتقرير الجماعي	{"count": 9}	2026-10-24 04:28:18.716347-07
197	1	shift.update	1	حسب توجهات  المدير	{"policy_snapshot": "Existing duty records unchanged"}	2026-10-24 04:44:36.63245-07
198	1	account.approve	22	اعتماد وقبول الحساب من لوحة التحكم	{"role": "employee", "shift_id": 1, "branch_id": 1, "previous_active": false}	2026-10-24 04:49:51.635148-07
199	1	attendance.edit	10	1	{"after": {"id": "10", "state": "outside", "first_in": "2026-10-24T11:51:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T11:51:36.922Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 22, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 396, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T11:51:34.906Z", "revision": 109, "last_received": "2026-10-24T11:51:36.922Z"}}, "before": {"id": "10", "state": "inside", "first_in": "2026-10-24T11:51:15.106Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T11:51:36.922Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 22, "exit_reason": null, "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 396, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T11:51:34.906Z", "revision": 109, "last_received": "2026-10-24T11:51:36.922Z"}}}	2026-10-24 04:52:11.565811-07
200	1	attendance.edit	10	1	{"after": {"id": "10", "state": "inside", "first_in": "2026-10-24T11:51:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T11:51:36.922Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 22, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 396, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T11:51:34.906Z", "revision": 109, "last_received": "2026-10-24T11:51:36.922Z"}}, "before": {"id": "10", "state": "outside", "first_in": "2026-10-24T11:51:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T11:51:36.922Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 22, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 396, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T11:51:34.906Z", "revision": 109, "last_received": "2026-10-24T11:51:36.922Z"}}}	2026-10-24 04:52:27.483137-07
201	1	reports.export	employee_dossier	تصدير Word لسجل موظف	{"count": 1, "employee_id": 22}	2026-10-24 05:09:14.382758-07
202	1	reports.export	collective_summary	تصدير Word للتقرير الجماعي	{"count": 10}	2026-10-24 05:09:40.915216-07
203	1	reports.export	collective_summary	تصدير Word للتقرير الجماعي	{"count": 10}	2026-10-24 05:10:45.832657-07
204	1	reports.export	collective_summary	تصدير Word للتقرير الجماعي	{"count": 10}	2026-10-24 05:11:44.005376-07
205	1	reports.export	collective_summary	تصدير Word للتقرير الجماعي	{"count": 10}	2026-10-24 05:14:32.00414-07
206	1	reports.export	collective_summary	تصدير Word (قالب رسمي) للتقرير الجماعي	{"count": 10}	2026-10-24 05:15:44.405994-07
207	1	reports.export	collective_summary	تصدير CSV للتقرير الجماعي	{"count": 10}	2026-10-24 05:17:51.919427-07
208	1	reports.export	collective_summary	تصدير TXT للتقرير الجماعي	{"count": 10}	2026-10-24 05:18:02.345522-07
209	1	attendance.edit	11	1	{"after": {"id": "11", "state": "inside", "first_in": "2026-10-24T12:51:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T12:51:34.977Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 456, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T12:51:34.445Z", "revision": 109, "last_received": "2026-10-24T12:51:34.977Z"}}, "before": {"id": "11", "state": "inside", "first_in": "2026-10-24T12:51:23.466Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T12:51:34.977Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": null, "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 456, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T12:51:34.445Z", "revision": 109, "last_received": "2026-10-24T12:51:34.977Z"}}}	2026-10-24 05:53:51.587008-07
210	1	attendance.edit	12	1	{"after": {"id": "12", "state": "inside", "first_in": "2026-10-24T12:51:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T12:51:35.354Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 11, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 456, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T12:51:32.995Z", "revision": 109, "last_received": "2026-10-24T12:51:35.354Z"}}, "before": {"id": "12", "state": "inside", "first_in": "2026-10-24T12:51:35.328Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T12:51:35.354Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 11, "exit_reason": null, "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 456, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T12:51:32.995Z", "revision": 109, "last_received": "2026-10-24T12:51:35.354Z"}}}	2026-10-24 05:54:00.140438-07
211	1	attendance.edit	10	1	{"after": {"id": "10", "state": "outside", "first_in": "2026-10-24T11:51:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T11:51:36.922Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 22, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 396, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T11:51:34.906Z", "revision": 109, "last_received": "2026-10-24T11:51:36.922Z"}}, "before": {"id": "10", "state": "inside", "first_in": "2026-10-24T11:51:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T11:51:36.922Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 22, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 396, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T11:51:34.906Z", "revision": 109, "last_received": "2026-10-24T11:51:36.922Z"}}}	2026-10-24 12:49:54.525275-07
212	1	attendance.edit	11	1	{"after": {"id": "11", "state": "inside", "first_in": "2026-10-24T12:51:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T12:51:34.977Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 456, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T12:51:34.445Z", "revision": 109, "last_received": "2026-10-24T12:51:34.977Z"}}, "before": {"id": "11", "state": "inside", "first_in": "2026-10-24T12:51:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "last_seen": "2026-10-24T12:51:34.977Z", "shift_end": "2026-10-24T17:00:00.000Z", "deduct_away": true, "employee_id": 17, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-24T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 456, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-24T12:51:34.445Z", "revision": 109, "last_received": "2026-10-24T12:51:34.977Z"}}}	2026-10-24 12:50:06.266354-07
213	1	account.reset_device	8	فك قيد الجهاز بطلب من الإدارة	{"previous_device": "هاتف K", "previous_device_id": "02d8554c-1b0e-4904-b509-61fe916b06f8"}	2026-10-25 00:44:14.735693-07
214	1	account.delete	8	حذف حساب الموظف (Anoos Aziz)	{"identifier": "003", "account_name": "Anoos Aziz"}	2026-10-25 00:44:20.607593-07
215	1	account.approve	23	اعتماد وقبول الحساب من لوحة التحكم	{"role": "employee", "shift_id": 1, "branch_id": 1, "previous_active": false}	2026-10-25 00:45:40.343292-07
216	1	account.approve	24	اعتماد وقبول الحساب من لوحة التحكم	{"role": "employee", "shift_id": 1, "branch_id": 1, "previous_active": false}	2026-10-25 01:22:33.691693-07
217	1	account.update	11	الا	{"email": "msb701789@gmail.com", "phone": null, "active": true, "shift_id": 1, "branch_id": 1, "permissions": ["employees.read", "shifts.write", "leave.review", "reports.export", "qr.manage"], "password_changed": false}	2026-10-25 01:31:54.209449-07
218	11	branch.update	1	تحديث إحداثيات الفرع إلى موقع الجهاز الحالي	{"after": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3060835, "longitude": 44.1982291, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 110, "exit_delay_seconds": 120}, "before": {"id": 1, "name": "AI-ASAAS", "active": true, "latitude": 15.3063394, "longitude": 44.1982026, "exit_radius": 120, "qr_revision": 5, "entry_radius": 80, "exit_samples": 3, "max_accuracy": 30, "location_revision": 109, "exit_delay_seconds": 120}}	2026-10-25 01:44:53.243225-07
219	11	account.update	23	4k44k4kk4	{"email": "anoos.alaghbari@gmail.com", "phone": null, "active": true, "shift_id": 1, "branch_id": 1, "permissions": ["audit.read"], "password_changed": false}	2026-10-25 01:46:08.131263-07
220	1	account.update	11	1	{"email": "msb701789@gmail.com", "phone": null, "active": true, "shift_id": 1, "branch_id": 1, "permissions": ["employees.read", "shifts.write", "leave.review", "reports.export", "qr.manage"], "password_changed": false}	2026-10-25 01:46:49.50207-07
221	11	reports.export	collective_summary	تصدير Word (قالب رسمي) للتقرير الجماعي	{"count": 10}	2026-10-25 01:47:31.556597-07
222	11	reports.export	collective_summary	تصدير Word (قالب رسمي) للتقرير الجماعي	{"count": 10}	2026-10-25 01:47:40.260209-07
223	1	account.update	11	1	{"email": "msb701789@gmail.com", "phone": null, "active": true, "shift_id": 1, "branch_id": 1, "permissions": [], "password_changed": false}	2026-10-25 01:53:18.139618-07
224	1	account.create	25	إضافة حساب	{}	2026-10-25 01:55:05.431035-07
225	1	account.approve	26	اعتماد وقبول الحساب من لوحة التحكم	{"role": "employee", "shift_id": 1, "branch_id": 1, "is_remote": false, "previous_active": false}	2026-10-25 02:15:18.268065-07
226	1	attendance.edit	19	1	{"after": {"id": "19", "state": "inside", "first_in": "2026-10-25T09:16:00.000Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "is_remote": false, "last_seen": "2026-10-25T09:18:03.620Z", "shift_end": "2026-10-25T17:00:00.000Z", "deduct_away": true, "employee_id": 26, "exit_reason": "مغادرة نطاق الموقع تلقائياً (GPS)", "shift_start": "2026-10-25T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 241, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-25T09:18:02.384Z", "revision": 110, "last_received": "2026-10-25T09:18:03.620Z"}}, "before": {"id": "19", "state": "inside", "first_in": "2026-10-25T09:16:22.402Z", "last_out": null, "shift_id": 1, "branch_id": 1, "gps_state": "inside", "is_remote": false, "last_seen": "2026-10-25T09:18:03.620Z", "shift_end": "2026-10-25T17:00:00.000Z", "deduct_away": true, "employee_id": 26, "exit_reason": null, "shift_start": "2026-10-25T05:00:00.000Z", "away_seconds": 0, "away_started": null, "close_policy": "actual_exit", "late_minutes": 241, "exit_candidate": {"exit": false, "count": 0, "since": null, "last_fix": "2026-10-25T09:18:02.384Z", "revision": 110, "last_received": "2026-10-25T09:18:03.620Z"}}}	2026-10-25 02:19:26.21522-07
227	1	shift.update	1	1	{"policy_snapshot": "Existing duty records unchanged"}	2026-10-25 03:30:39.659063-07
228	1	account.approve	27	اعتماد وقبول الحساب من لوحة التحكم	{"role": "employee", "shift_id": 1, "branch_id": 1, "is_remote": false, "previous_active": false}	2026-10-25 03:35:04.955571-07
229	1	account.update	27	1	{"email": "anaskhodayf@gmail.com", "phone": null, "active": true, "shift_id": 1, "branch_id": 1, "permissions": [], "password_changed": false}	2026-10-25 03:35:25.477263-07
230	1	account.approve	28	اعتماد وقبول الحساب من لوحة التحكم	{"role": "employee", "shift_id": 1, "branch_id": 1, "is_remote": false, "previous_active": false}	2026-10-25 03:40:28.738664-07
231	1	account.update	28	1	{"email": "abdulmajeedqat@gmail.com", "phone": null, "active": true, "shift_id": 1, "branch_id": 1, "permissions": [], "password_changed": false}	2026-10-25 03:40:46.233885-07
232	1	account.approve	29	اعتماد وقبول الحساب من لوحة التحكم	{"role": "employee", "shift_id": 1, "branch_id": 1, "is_remote": false, "previous_active": false}	2026-10-25 03:58:37.701523-07
233	1	reports.export	collective_summary	تصدير Word (قالب رسمي) للتقرير الجماعي	{"count": 15}	2026-10-25 05:06:30.766903-07
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
ea59784c3141dacb3978ca43327b5d52b1b8c07041bf302effb1b7ba80e4593f	1	2027-10-20 02:31:11.390551-07	2026-10-20 01:53:49.928295-07
b417cb08cebd3de1cf65c4b1cadcf3811818942c20e565486f6c6c1cacec3b25	1	2027-10-20 02:38:24.780101-07	2026-10-20 02:38:24.780101-07
fbe6eb621493fd4ee91563c1a7d804989b6c6fe9f9991fd39f9f02746a32cd96	1	2027-10-20 03:01:04.795878-07	2026-10-20 03:01:04.795878-07
dfc983965a47e41806c542097f18bae678e9c1b482e7e60e31e71ec109f2431f	1	2026-10-21 04:29:07.893389-07	2026-10-20 04:29:07.893389-07
4da44112ed41155f2d4772e99db0cff12e6c2f1ebbcc066d069a2e6979155496	1	2026-10-21 04:29:17.003441-07	2026-10-20 04:29:17.003441-07
93ad5efe38fa131fcd3d6c6266c5b9f7b6faec0881b417e79a2e680a7c233749	1	2027-10-20 22:07:36.078346-07	2026-10-20 22:07:36.078346-07
41a3d5ea0c83f6b0f142b1d299d680fe856f76c37e804a103e4f48ed854cb0d8	1	2027-10-20 22:10:13.788159-07	2026-10-20 22:10:13.788159-07
dc327164926d7f81cdb42932b7af0d49517fca2c8f3fc536dc2d51d2fbfcc248	1	2027-10-20 22:10:18.390747-07	2026-10-20 22:10:18.390747-07
af4f15866075e601c695be27a660e9774e668aa96ab3e0ce0d06b2931733c76e	1	2027-10-20 22:10:29.198846-07	2026-10-20 22:10:29.198846-07
3af526e2b95041049de66dc94503414c30f7b7694e11ac6d5c748d6cd410b78c	1	2027-10-20 22:10:36.050376-07	2026-10-20 22:10:36.050376-07
983b12f15afcd9972ce94aa2f4467a207e9c13c1d61e53e4d281995c40fa614c	1	2027-10-20 22:33:43.755122-07	2026-10-20 22:33:43.755122-07
eac69bc664514b5a8588dd90be37a048d372d1f5ed0049b369217a67688fb754	1	2027-10-22 14:43:48.797233-07	2026-10-22 14:43:48.797233-07
5d9870b205475a67a988ef91d832e55aefefbf5bda27f86dbc47bfb0faf5e111	22	2027-10-24 04:50:41.593178-07	2026-10-24 04:50:41.593178-07
af63aab039bd54aa1553562c8a693698b929ed21c07aca83ec8f539565087415	1	2027-10-20 23:24:33.753673-07	2026-10-20 23:24:33.753673-07
bbfcfa77f0a3f8d8572a9a8aa187020c0a9df5f146bc84d0b2a1e883a0fef8ab	1	2027-10-20 23:33:25.313823-07	2026-10-20 23:33:25.313823-07
9ac221ccac2467ec99e31fdfa227da387af1aae0f653afd3db342122ed2b8804	1	2027-10-24 05:46:33.038585-07	2026-10-24 05:46:33.038585-07
b8231bf9bf3f51a979dcfe627f8d1abf6211067fc80953079c1574eaabe5d8a6	1	2027-10-21 00:03:37.74811-07	2026-10-21 00:03:37.74811-07
afc781849dcd804ce73501a110e133548bfcc6f91a2b65982f80dfeeb55a7da1	1	2027-10-21 00:05:10.977552-07	2026-10-21 00:05:10.977552-07
d83e18f6da57ced76b379253387fafd5bef18e9c536d83fcba7ae9034d7e0b46	24	2027-10-25 01:23:18.451291-07	2026-10-25 01:23:18.451291-07
4787a7edea30d509fdf4c5af8e67c6a4d87981193d2c97d1f5373870e9448338	11	2027-10-25 01:59:57.158409-07	2026-10-25 01:59:57.158409-07
061fb5fcf55047366cdd53d444a0369880194af69f2424ca81a117c32422df7f	26	2027-10-25 02:16:10.723067-07	2026-10-25 02:16:10.723067-07
fc6f5adaa7a7d8e103ec6d599819bf03b4bfd81fe110f43f7fcddb83fcaec722	27	2027-10-25 03:36:37.260675-07	2026-10-25 03:36:37.260675-07
20a87f483b497898b13497b5f400ff89f09821b8a463518dc17fc99235482f2a	28	2027-10-25 03:41:31.136935-07	2026-10-25 03:41:31.136935-07
eaa79a3e11da82eb04801902272efd22e4f199ecfafec669c8d04d47e978a3a5	1	2027-10-25 05:06:15.891728-07	2026-10-25 05:06:15.891728-07
7a9019be267feac750b3a75d81ab4a8dfea352faa256143dc05a5315c6483554	1	2027-10-27 01:49:31.507483-07	2026-10-27 01:49:31.507483-07
8d8e653ae1bab836e553a3e6f71b94643f8b24d7d929c32f1a0e58ee533890d4	13	2027-10-22 02:53:48.456908-07	2026-10-22 02:53:48.456908-07
7d3c74917f3d8bb19d429e809f93f02a0895493e7b77f0396b071e5ba74b791d	14	2027-10-22 03:15:23.292524-07	2026-10-22 03:15:23.292524-07
1493b449976555ac71e2475cb7eba5792c686dd17aef20feaa033ab5fcf6e3a2	1	2026-10-22 04:28:45.632684-07	2026-10-22 03:28:45.632684-07
088eaaee02af07f8db910ec5771d18ee565bb42453f9f9985f3f5bc84884f4ba	1	2027-10-22 04:01:11.146422-07	2026-10-22 04:01:11.146422-07
caed0dc4735cafb4b876223f1c7dfa3026bb1c57ba7c2930c0b3d74812993717	17	2027-10-22 04:04:01.46849-07	2026-10-22 04:04:01.46849-07
829fd8baba438ace7a982cc2da9c56781ba5bdaa5c09d4f90a8d8c808808aace	19	2027-10-22 04:15:54.667824-07	2026-10-22 04:15:54.667824-07
56145f85442edf25c90617cfd02bea97d36743059c0d3494847d41800f4bd6f9	20	2027-10-22 04:16:36.752688-07	2026-10-22 04:16:36.752688-07
a4a03a9970a8ea661a96299354da3ddf0ee3a31d8012e1fa3e3ce0e66d6c0408	21	2027-10-22 05:22:08.284325-07	2026-10-22 05:22:08.284325-07
\.


--
-- Data for Name: branches; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.branches (id, name, latitude, longitude, entry_radius, exit_radius, max_accuracy, exit_samples, exit_delay_seconds, active, location_revision, qr_revision) FROM stdin;
1	AI-ASAAS	15.3060835	44.1982291	80	120	30	3	120	t	110	5
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.departments (id, name) FROM stdin;
\.


--
-- Data for Name: duty_records; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.duty_records (id, employee_id, branch_id, shift_id, shift_start, shift_end, first_in, last_out, state, exit_reason, close_policy, deduct_away, away_started, away_seconds, late_minutes, gps_state, last_seen, exit_candidate, is_remote) FROM stdin;
22	14	1	1	2026-10-24 22:00:00-07	2026-10-25 10:00:00-07	2026-10-25 05:19:03.459-07	2026-10-25 10:00:00-07	closed	scheduled	scheduled	t	\N	0	424	inside	2026-10-25 05:19:03.459-07	\N	f
19	26	1	1	2026-10-24 22:00:00-07	2026-10-25 10:00:00-07	2026-10-25 02:16:00-07	\N	inside	مغادرة نطاق الموقع تلقائياً (GPS)	actual_exit	t	\N	0	241	inside	2026-10-25 02:18:03.62-07	{"exit": false, "count": 0, "since": null, "last_fix": "2026-10-25T09:18:02.384Z", "revision": 110, "last_received": "2026-10-25T09:18:03.620Z"}	f
21	28	1	1	2026-10-24 22:00:00-07	2026-10-25 10:00:00-07	2026-10-25 03:46:10.321-07	2026-10-25 10:00:00-07	closed	scheduled	scheduled	t	\N	0	331	inside	2026-10-25 04:52:27.699-07	\N	f
16	23	1	1	2026-10-24 22:00:00-07	2026-10-25 10:00:00-07	2026-10-25 00:46:01.525-07	\N	inside	\N	actual_exit	t	\N	0	151	inside	2026-10-25 03:55:17.472-07	{"exit": false, "count": 0, "since": null, "last_fix": "2026-10-25T10:55:16.735Z", "revision": 110, "last_received": "2026-10-25T10:55:17.472Z"}	f
9	19	1	1	2026-10-21 22:00:00-07	2026-10-22 06:00:00-07	2026-10-22 04:16:02.086-07	2026-10-22 04:16:22.522-07	outside	خروج مبكر قبل نهاية الدوام بـ 104 دقيقة	actual_exit	t	2026-10-22 04:16:22.522-07	0	361	inside	2026-10-22 04:16:22.522-07	\N	f
8	17	1	1	2026-10-21 22:00:00-07	2026-10-22 06:00:00-07	2026-10-22 04:06:00-07	2026-10-22 04:50:00-07	outside	مغادرة نطاق الموقع تلقائياً (GPS)	actual_exit	t	\N	2	351	inside	2026-10-22 05:24:59.862-07	\N	f
5	13	1	1	2026-10-21 22:00:00-07	2026-10-22 06:00:00-07	2026-10-22 02:53:53.319-07	2026-10-22 04:16:42.58-07	outside	خروج مبكر قبل نهاية الدوام بـ 103 دقيقة	actual_exit	t	2026-10-22 04:16:42.58-07	5	278	inside	2026-10-22 04:16:42.58-07	\N	f
10	22	1	1	2026-10-23 22:00:00-07	2026-10-24 10:00:00-07	2026-10-24 04:51:00-07	\N	outside	مغادرة نطاق الموقع تلقائياً (GPS)	actual_exit	t	\N	0	396	inside	2026-10-24 04:51:36.922-07	\N	f
13	22	1	1	2026-10-24 22:00:00-07	2026-10-25 10:00:00-07	2026-10-24 23:06:42.448-07	\N	inside	\N	actual_exit	t	\N	0	51	inside	2026-10-24 23:06:59.269-07	\N	f
18	24	1	1	2026-10-24 22:00:00-07	2026-10-25 10:00:00-07	2026-10-25 01:23:55.173-07	\N	inside	\N	actual_exit	t	\N	0	188	inside	2026-10-25 01:27:22.176-07	\N	f
17	17	1	1	2026-10-24 22:00:00-07	2026-10-25 10:00:00-07	2026-10-25 01:07:26.425-07	\N	inside	\N	actual_exit	t	\N	0	172	inside	2026-10-25 05:18:02.775-07	{"exit": false, "count": 0, "since": null, "last_fix": "2026-10-25T12:17:58.605Z", "revision": 110, "last_received": "2026-10-25T12:18:02.775Z"}	f
20	27	1	1	2026-10-24 22:00:00-07	2026-10-25 10:00:00-07	2026-10-25 03:37:10.205-07	2026-10-25 10:00:00-07	closed	scheduled	scheduled	t	\N	0	322	inside	2026-10-25 03:39:51.893-07	\N	f
6	14	1	1	2026-10-21 22:00:00-07	2026-10-22 06:00:00-07	2026-10-22 03:15:00-07	\N	outside	مغادرة نطاق الموقع تلقائياً (GPS)	actual_exit	t	\N	0	300	inside	2026-10-22 03:23:21.202-07	\N	f
12	11	1	1	2026-10-23 22:00:00-07	2026-10-24 10:00:00-07	2026-10-24 05:51:00-07	2026-10-24 07:34:57.716-07	outside	مغادرة نطاق الموقع تلقائياً (GPS)	actual_exit	t	2026-10-24 07:34:57.716-07	0	456	outside	2026-10-24 07:34:57.716-07	\N	f
11	17	1	1	2026-10-23 22:00:00-07	2026-10-24 10:00:00-07	2026-10-24 05:51:00-07	2026-10-25 01:07:23.62-07	outside	انتهاء عمل إضافي (+907 دقيقة)	actual_exit	t	2026-10-25 01:07:23.62-07	0	456	inside	2026-10-25 01:07:23.62-07	\N	f
14	11	1	1	2026-10-24 22:00:00-07	2026-10-25 10:00:00-07	2026-10-25 00:42:22.917-07	\N	inside	\N	actual_exit	t	\N	0	147	inside	2026-10-25 00:42:51.097-07	\N	f
\.


--
-- Data for Name: leave_requests; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.leave_requests (id, employee_id, from_date, to_date, reason, status, reviewed_by, comment, created_at) FROM stdin;
4	13	2026-10-25	2026-10-25	لم أستطيع الحضور الصباح ولم استطع الحضور الان بسبب السيول	pending	\N	\N	2026-10-25 04:49:12.462139-07
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.shifts (id, name, start_time, end_time, work_days, grace_minutes, close_policy, deduct_away) FROM stdin;
2	الفتره  الثانية	03:00:00	22:00:00	{0,1,2,3,4}	15	actual_exit	f
1	الفتره الاولى	08:00:00	20:00:00	{0,1,2,3,4,6}	15	scheduled	t
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

SELECT pg_catalog.setval('public.accounts_id_seq', 29, true);


--
-- Name: announcements_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.announcements_id_seq', 4, true);


--
-- Name: attendance_events_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.attendance_events_id_seq', 1172, true);


--
-- Name: audit_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.audit_log_id_seq', 233, true);


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

SELECT pg_catalog.setval('public.duty_records_id_seq', 22, true);


--
-- Name: leave_requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.leave_requests_id_seq', 4, true);


--
-- Name: shifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.shifts_id_seq', 2, true);


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

\unrestrict INHfFAbzGF81mL80u0xY1U8Kq8gPgYp5bA18jwQcfBZndK8xPJJivzMvV94aQ88

