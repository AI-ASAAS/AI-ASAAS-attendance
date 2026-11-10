'use strict';

const fs = require('node:fs');
const path = require('node:path');
const db = require('../config/database');
const { AppError } = require('../utils/AppError');
const policyEngine = require('./attendance-policy');

const PROMPT_VERSION = 'asaas-assistant-v1.1';
const PROMPT_PATH = path.resolve(__dirname, '../prompts/assistant.md');
const DEFAULT_FREE_API_URL = 'https://api.llm7.io/v1/chat/completions';
const DEFAULT_FREE_MODEL = 'mistral-Nemo-Instruct-2407';
const SECONDARY_FREE_API_URL = 'https://text.pollinations.ai/openai';
const SECONDARY_FREE_MODEL = 'openai';

const FIXED_REFUSALS = {
  offTopic:
    'عذراً، أنا مساعد أساس المخصص للاستفسار عن الحضور والدوام والورديات والإجازات وآلية التسجيل فقط، ولا يمكنني الإجابة على أسئلة خارج هذا النطاق.',
  injection:
    'عذراً، هذا الطلب غير مسموح به وفق ضوابط أمان منظومة أساس.',
  privacy:
    'عذراً، وفق قيود الخصوصية المخصصة لحسابك لا يمكنك الاطلاع إلا على بياناتك وسجلاتك الوظيفية الخاصة فقط.',
  hoursRestricted:
    'عذراً، تم تقييد استعلامات الساعات والتقارير التفصيلية لحسابك من قِبل الإدارة.',
  leaveRestricted:
    'عذراً، تم تقييد الاستعلام عن الإجازات والاستئذانات لحسابك من قِبل الإدارة.',
  generalRestricted:
    'عذراً، حسابك مقصور على ملخص حالة الحضور اليومية فقط دون الاستعلامات الإرشادية الإضافية.',
  keywordBlocked:
    'عذراً، يتضمن سؤالك موضوعاً مقيداً ضمن ضوابط الاستخدام المخصصة لحسابك من قِبل الإدارة.'
};

function loadPromptTemplate() {
  try {
    return fs.readFileSync(PROMPT_PATH, 'utf8').trim();
  } catch {
    return 'أنت مساعد أساس الذكي لمتابعة الحضور والدوام. أجب باختصار بالاعتماد فقط على البيانات المصرح بها.';
  }
}

function isSafeLlmUrl(raw) {
  try {
    const u = new URL(String(raw || '').trim());
    if (u.protocol === 'https:') {
      const host = u.hostname.toLowerCase();
      if (host === '169.254.169.254' || host.startsWith('10.') || host.startsWith('192.168.') || host === '127.0.0.1' || host === 'localhost') {
        return false;
      }
      return true;
    }
    if (u.protocol === 'http:') {
      const host = u.hostname.toLowerCase();
      return host === '127.0.0.1' || host === 'localhost';
    }
    return false;
  } catch {
    return false;
  }
}

async function loadGlobalAssistantSettings() {
  const rows = (await db.query("SELECT key, value FROM system_settings WHERE key LIKE 'assistant_%'")).rows;
  const map = {};
  for (const r of rows) map[r.key] = r.value;

  const empQuota = Number(map.assistant_daily_quota_employee);
  const adminQuota = Number(map.assistant_daily_quota_admin);
  const maxChars = Number(map.assistant_max_chars);

  return {
    enabled: map.assistant_enabled !== 'false',
    dailyQuotaEmployee: Number.isInteger(empQuota) && empQuota >= 1 && empQuota <= 500 ? empQuota : 20,
    dailyQuotaAdmin: Number.isInteger(adminQuota) && adminQuota >= 1 && adminQuota <= 2000 ? adminQuota : 100,
    strictTopic: map.assistant_strict_topic !== 'false',
    maxChars: Number.isInteger(maxChars) && maxChars >= 50 && maxChars <= 2000 ? maxChars : 800,
    apiUrl: map.assistant_api_url || process.env.AI_API_URL || '',
    model: map.assistant_model || process.env.AI_MODEL || ''
  };
}

function resolveLlmProvider(globalSettings) {
  const configuredUrl = String(globalSettings?.apiUrl || process.env.AI_API_URL || '').trim();
  const configuredModel = String(globalSettings?.model || process.env.AI_MODEL || '').trim();

  if (configuredUrl && isSafeLlmUrl(configuredUrl)) {
    return {
      name: configuredUrl.includes('groq.com')
        ? 'Groq'
        : configuredUrl.includes('openrouter.ai')
          ? 'OpenRouter'
          : configuredUrl.includes('generativelanguage.googleapis.com')
            ? 'Gemini'
            : configuredUrl.includes('llm7.io')
              ? 'LLM7 Free AI'
              : configuredUrl.includes('pollinations.ai')
                ? 'Pollinations Free AI'
                : 'Custom OpenAI-Compatible',
      apiUrl: configuredUrl,
      apiKey: process.env.AI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENROUTER_API_KEY || process.env.GEMINI_API_KEY || '',
      model: configuredModel || DEFAULT_FREE_MODEL,
      free: true
    };
  }
  if (process.env.GROQ_API_KEY) {
    return {
      name: 'Groq Free Tier',
      apiUrl: 'https://api.groq.com/openai/v1/chat/completions',
      apiKey: process.env.GROQ_API_KEY,
      model: configuredModel || 'llama-3.3-70b-versatile',
      free: true
    };
  }
  if (process.env.OPENROUTER_API_KEY) {
    return {
      name: 'OpenRouter Free Tier',
      apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
      apiKey: process.env.OPENROUTER_API_KEY,
      model: configuredModel || 'meta-llama/llama-3.3-70b-instruct:free',
      free: true
    };
  }
  if (process.env.GEMINI_API_KEY) {
    return {
      name: 'Google Gemini Free Tier',
      apiUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
      apiKey: process.env.GEMINI_API_KEY,
      model: configuredModel || 'gemini-2.0-flash',
      free: true
    };
  }
  return {
    name: 'LLM7 Free AI',
    apiUrl: DEFAULT_FREE_API_URL,
    apiKey: '',
    model: configuredModel || DEFAULT_FREE_MODEL,
    free: true
  };
}

function resolveProviderChain(globalSettings) {
  const primary = resolveLlmProvider(globalSettings);
  const chain = [primary];
  if (!process.env.AI_API_URL && !globalSettings?.apiUrl && !process.env.GROQ_API_KEY && !process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
    chain.push({
      name: 'Pollinations Free AI',
      apiUrl: SECONDARY_FREE_API_URL,
      apiKey: '',
      model: SECONDARY_FREE_MODEL,
      free: true
    });
  }
  return chain;
}

async function getEffectiveUserPolicy(user) {
  const globals = await loadGlobalAssistantSettings();
  const row = (await db.query('SELECT * FROM assistant_user_policies WHERE account_id=$1', [user.id])).rows[0] || null;
  const isAdmin = user.role !== 'employee';
  const defaultQuota = isAdmin ? globals.dailyQuotaAdmin : globals.dailyQuotaEmployee;
  const customLimit = row && row.daily_limit !== null && row.daily_limit !== undefined ? Number(row.daily_limit) : null;

  return {
    globalEnabled: globals.enabled,
    enabled: globals.enabled && (row ? Boolean(row.enabled) : true),
    daily_limit: customLimit !== null && Number.isInteger(customLimit) && customLimit >= 0 ? customLimit : defaultQuota,
    has_custom_limit: customLimit !== null,
    allow_hours_info: row ? Boolean(row.allow_hours_info) : true,
    allow_leave_info: row ? Boolean(row.allow_leave_info) : true,
    allow_team_data: isAdmin ? (row ? Boolean(row.allow_team_data) : true) : false,
    allow_general_help: row ? Boolean(row.allow_general_help) : true,
    strict_topic_only: globals.strictTopic ? true : (row ? Boolean(row.strict_topic_only) : true),
    blocked_keywords: row ? String(row.blocked_keywords || '').trim() : '',
    custom_note: row ? String(row.custom_note || '').trim().slice(0, 400) : '',
    max_chars: globals.maxChars,
    globals
  };
}

async function getDailyUsage(accountId, day = policyEngine.localDay()) {
  const row = (await db.query('SELECT questions_count, blocked_count, last_asked_at FROM assistant_usage_daily WHERE account_id=$1 AND day=$2', [accountId, day])).rows[0];
  return {
    day,
    questions_count: Number(row?.questions_count || 0),
    blocked_count: Number(row?.blocked_count || 0),
    last_asked_at: row?.last_asked_at || null
  };
}

async function recordUsage(accountId, day, blocked = false) {
  await db.query(
    `INSERT INTO assistant_usage_daily(account_id, day, questions_count, blocked_count, last_asked_at)
     VALUES($1, $2, $3, $4, strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(account_id, day) DO UPDATE SET
       questions_count = assistant_usage_daily.questions_count + EXCLUDED.questions_count,
       blocked_count = assistant_usage_daily.blocked_count + EXCLUDED.blocked_count,
       last_asked_at = EXCLUDED.last_asked_at`,
    [accountId, day, blocked ? 0 : 1, blocked ? 1 : 0]
  );
}

function parseKeywords(raw) {
  return String(raw || '')
    .split(/[,،\n;|]+/)
    .map(s => s.trim().toLowerCase())
    .filter(s => s.length >= 2)
    .slice(0, 25);
}

function classifyAndValidateQuestion(question, user, policy) {
  const q = String(question || '').trim();
  const ql = q.toLowerCase();

  const injectionRe = /(ignore\s+(all|previous|above)|system\s+prompt|reveal\s+prompt|jailbreak|bypass\s+rules|تجاهل\s+التعليمات|اكشف\s+التعليمات|برومبت|كلمة\s+المرور|كلمة\s+السر|كود\s+sql|select\s+\*|drop\s+table|<script|process\.env|qr_secret)/i;
  if (injectionRe.test(q)) {
    return { blocked: true, reason: 'injection', reply: FIXED_REFUSALS.injection };
  }

  const customBlocked = parseKeywords(policy.blocked_keywords);
  for (const kw of customBlocked) {
    if (ql.includes(kw)) {
      return { blocked: true, reason: 'keyword_blocked', reply: FIXED_REFUSALS.keywordBlocked };
    }
  }

  if (!policy.allow_team_data) {
    const teamProbeRe = /(زميل|زملائي|الموظفين|بقية\s+الموظفين|باقي\s+الموظفين|موظف\s+آخر|غيري|رواتب\s+الموظف|من\s+تأخر|من\s+غائب|المتأخرون|الغائبون|قائمة\s+الحضور|تقرير\s+جماعي|كل\s+العمال|حساب\s+محمد|حساب\s+أحمد|بيانات\s+غيري)/i;
    if (teamProbeRe.test(q)) {
      return { blocked: true, reason: 'privacy', reply: FIXED_REFUSALS.privacy };
    }
  }

  if (!policy.allow_hours_info) {
    const hoursRe = /(ساعات|ساعه|ساعة|إجمالي\s+العمل|مجموع|تقرير\s+الشهر|التأخير|دقائق\s+التأخير|كم\s+ساعة)/i;
    if (hoursRe.test(q)) {
      return { blocked: true, reason: 'hours_restricted', reply: FIXED_REFUSALS.hoursRestricted };
    }
  }

  if (!policy.allow_leave_info) {
    const leaveRe = /(إجاز|اجاز|استئذان|طلب\s+إجاز)/i;
    if (leaveRe.test(q)) {
      return { blocked: true, reason: 'leave_restricted', reply: FIXED_REFUSALS.leaveRestricted };
    }
  }

  if (policy.strict_topic_only) {
    const domainRe = /(حضور|انصراف|دوام|وردي|فرع|مقر|موقع|gps|خريط|نطاق|جغراف|بصم|qr|رمز|باركود|إجاز|اجاز|استئذان|تأخر|تأخير|غائب|غياب|ساع|موظف|حساب|ملخص|حالتي|حالة|تعميم|إشعار|اشعار|عمل|مناوب|مكتب|عن\s+بعد|أونلاين|تقارير|تقرير|طلب|معلق|نظام|أساس|اساس|تسجيل|خروج|دخول|تفعيل|دعم|مساعد|مرحب|السلام|اهلا|أهلا)/i;
    const offTopicExplicitRe = /(اكتب\s+كود|برمج|بايثون|python|javascript|جافاسكربت|react|html|قصيد|شعر|قصة|نكتة|طبخ|وصفه|وصفة|مباراة|كرة\s+قدم|سياسة|انتخابات|ترجم|امتحان|واجب\s+مدرسي|فيزياء|كيمياء|تاريخ|رياضيات|عملات\s+رقمية|بيتكوين|سعر\s+الدولار|أغنية|فيلم)/i;
    if (offTopicExplicitRe.test(q) || (q.length > 18 && !domainRe.test(q))) {
      return { blocked: true, reason: 'off_topic', reply: FIXED_REFUSALS.offTopic };
    }
  }

  if (!policy.allow_general_help) {
    const howtoRe = /(كيف|طريقة|شرح|خطوات|تفعيل|مساعدة)/i;
    if (howtoRe.test(q)) {
      return { blocked: true, reason: 'general_restricted', reply: FIXED_REFUSALS.generalRestricted };
    }
  }

  return { blocked: false };
}

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleTimeString('ar-YE', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Aden' });
  } catch {
    return '—';
  }
}

async function buildGroundedContext(user, policy, { recordsFor, countedMinutes }) {
  const today = policyEngine.localDay();
  const isAdmin = user.role !== 'employee';

  if (isAdmin) {
    const broad = ['super_admin', 'hr_admin'].includes(user.role);
    const context = {
      user_role: user.role,
      user_name: user.name,
      date: today,
      scope: broad ? 'جميع الفروع' : 'الفرع المرتبط بالحساب فقط',
      restrictions: {
        allow_team_data: policy.allow_team_data,
        allow_hours_info: policy.allow_hours_info,
        allow_leave_info: policy.allow_leave_info
      }
    };

    if (policy.allow_team_data) {
      const rows = await recordsFor(user, today, today);
      const presentRows = rows.filter(r => r.id && r.first_in);
      const insideRows = presentRows.filter(r => r.state === 'inside');
      const lateRows = presentRows.filter(r => Number(r.late_minutes) > 0);
      const absentRows = rows.filter(r => r.state === 'absent');
      const leaveRows = rows.filter(r => r.state === 'leave');

      context.today_summary = {
        total_employees: rows.length,
        present_count: presentRows.length,
        attendance_rate_percent: rows.length ? Math.round((presentRows.length / rows.length) * 100) : 0,
        currently_inside_count: insideRows.length,
        absent_count: absentRows.length,
        absent_names: absentRows.slice(0, 15).map(r => `${r.name} (${r.branch_name || '—'})`),
        leave_count: policy.allow_leave_info ? leaveRows.length : null
      };

      if (policy.allow_hours_info) {
        context.today_summary.late_count = lateRows.length;
        context.today_summary.late_list = lateRows.slice(0, 12).map(r => `${r.name}: ${r.late_minutes} دقيقة (دخول ${fmtTime(r.first_in)})`);
      }

      const pendingAcc = (await db.query("SELECT name FROM accounts WHERE role='employee' AND active=FALSE AND ($1=1 OR branch_id=$2) ORDER BY id DESC LIMIT 10", [broad, user.branch_id])).rows;
      context.pending_account_activations = {
        count: pendingAcc.length,
        names: pendingAcc.slice(0, 5).map(a => a.name)
      };

      if (policy.allow_leave_info) {
        const pendingLeave = (await db.query("SELECT l.from_date, l.to_date, a.name FROM leave_requests l JOIN accounts a ON a.id=l.employee_id WHERE l.status='pending' AND ($1=1 OR a.branch_id=$2) ORDER BY l.id DESC LIMIT 10", [broad, user.branch_id])).rows;
        context.pending_leave_requests = {
          count: pendingLeave.length,
          items: pendingLeave.slice(0, 5).map(l => `${l.name} (${String(l.from_date).slice(0, 10)} → ${String(l.to_date).slice(0, 10)})`)
        };
      }
    }

    return context;
  }

  const shift = user.shift_id
    ? (await db.query('SELECT name, start_time, end_time, grace_minutes FROM shifts WHERE id=$1', [user.shift_id])).rows[0]
    : null;
  const branch = user.branch_id
    ? (await db.query('SELECT name, entry_radius FROM branches WHERE id=$1', [user.branch_id])).rows[0]
    : null;
  const month = today.slice(0, 7);
  const monthRows = (await db.query("SELECT first_in, last_out, state, late_minutes, away_seconds, deduct_away, shift_start, shift_end FROM duty_records WHERE employee_id=$1 AND strftime('%Y-%m', shift_start, '+3 hours')=$2 ORDER BY shift_start DESC", [user.id, month])).rows;
  const todayRow = monthRows.find(r => {
    try { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Aden' }).format(new Date(r.shift_start)) === today; }
    catch { return false; }
  }) || null;

  const ctx = {
    user_role: 'employee',
    user_name: user.name,
    date: today,
    work_mode: user.is_remote ? 'دوام عن بعد (أونلاين)' : `حضوري بالمقر (${branch?.name || 'الفرع الرئيسي'})`,
    branch_radius_meters: branch?.entry_radius ?? null,
    shift: shift ? { name: shift.name, start_time: shift.start_time, end_time: shift.end_time, grace_minutes: shift.grace_minutes ?? 15 } : null,
    today_attendance: todayRow
      ? {
          state: todayRow.state,
          first_in: fmtTime(todayRow.first_in),
          last_out: fmtTime(todayRow.last_out),
          late_minutes: policy.allow_hours_info ? Number(todayRow.late_minutes || 0) : null
        }
      : { state: 'not_checked_in' },
    restrictions: {
      allow_hours_info: policy.allow_hours_info,
      allow_leave_info: policy.allow_leave_info,
      allow_general_help: policy.allow_general_help
    }
  };

  if (policy.allow_hours_info) {
    const totalMins = monthRows.reduce((acc, r) => acc + countedMinutes(r), 0);
    ctx.monthly_summary = {
      month,
      attended_days: monthRows.filter(r => r.first_in).length,
      total_hours: Number((totalMins / 60).toFixed(1)),
      total_minutes: totalMins
    };
  }

  if (policy.allow_leave_info) {
    const leaves = (await db.query('SELECT status, from_date, to_date FROM leave_requests WHERE employee_id=$1 ORDER BY id DESC LIMIT 10', [user.id])).rows;
    ctx.leave_summary = {
      total_requests: leaves.length,
      pending_count: leaves.filter(l => l.status === 'pending').length,
      approved_count: leaves.filter(l => l.status === 'approved').length,
      latest_request: leaves[0]
        ? { from_date: String(leaves[0].from_date).slice(0, 10), to_date: String(leaves[0].to_date).slice(0, 10), status: leaves[0].status }
        : null
    };
  }

  return ctx;
}

function buildDeterministicReply(question, user, policy, context) {
  const q = String(question || '').trim().toLowerCase();
  const isAdmin = user.role !== 'employee';

  if (isAdmin) {
    if (!policy.allow_team_data) {
      return `مرحباً ${user.name}، حسابك مقيد بالوصول العام فقط ولا يملك صلاحية استعراض تفاصيل حضور الفريق من المساعد.`;
    }
    const sum = context.today_summary || {};
    if (q.includes('تأخر') || q.includes('متأخر')) {
      if (!policy.allow_hours_info) return FIXED_REFUSALS.hoursRestricted;
      if (!sum.late_count) return `لا يوجد أي موظف متأخر اليوم (${context.date}) ضمن نطاق صلاحيتك.`;
      return `المتأخرون اليوم (${sum.late_count}):\n${(sum.late_list || []).map(x => `• ${x}`).join('\n')}`;
    }
    if (q.includes('غائب') || q.includes('غياب') || q.includes('لم يسجل')) {
      if (!sum.absent_count) return `جميع الموظفين المكلّفين سجلوا حضورهم اليوم (${context.date}).`;
      return `لم يسجلوا حضورهم اليوم (${sum.absent_count} موظف):\n${(sum.absent_names || []).map(x => `• ${x}`).join('\n')}`;
    }
    if (q.includes('طلب') || q.includes('معلق') || q.includes('إجاز') || q.includes('موافق')) {
      const acc = context.pending_account_activations || { count: 0, names: [] };
      const lvs = context.pending_leave_requests;
      const lines = [`• طلبات تفعيل الحسابات المعلقة: ${acc.count}${acc.names.length ? ' (' + acc.names.join('، ') + ')' : ''}`];
      if (lvs) lines.push(`• طلبات الإجازات المعلقة: ${lvs.count}${lvs.items.length ? ' (' + lvs.items.map(i => i.split(' ')[0]).join('، ') + ')' : ''}`);
      return `حالة الطلبات المعلقة الآن:\n${lines.join('\n')}`;
    }
    return [
      `ملخص الحضور اليوم (${context.date}):`,
      `• إجمالي الموظفين: ${sum.total_employees ?? 0}`,
      `• الحاضرون: ${sum.present_count ?? 0} (نسبة الالتزام ${sum.attendance_rate_percent ?? 0}%)`,
      `• على رأس العمل الآن: ${sum.currently_inside_count ?? 0}`,
      `• ${policy.allow_hours_info ? `المتأخرون: ${sum.late_count ?? 0} | ` : ''}لم يسجلوا: ${sum.absent_count ?? 0}`
    ].join('\n');
  }

  if (q.includes('وردي') || q.includes('دوام') || q.includes('فرع') || q.includes('مقر') || q.includes('وقت')) {
    if (!context.shift) return `طبيعة دوامك: ${context.work_mode}. لم يتم ربط وردية محددة بعد.`;
    return `تفاصيل دوامك المعتمدة:\n• الوردية: ${context.shift.name} (من ${context.shift.start_time} إلى ${context.shift.end_time})\n• فترة السماح: ${context.shift.grace_minutes} دقيقة\n• طبيعة العمل: ${context.work_mode}`;
  }
  if (q.includes('شهر') || q.includes('ساع') || q.includes('مجموع') || q.includes('أيام')) {
    const ms = context.monthly_summary;
    return `ملخص دوامك لشهر ${ms.month}:\n• أيام الحضور المسجلة: ${ms.attended_days} يوم\n• إجمالي ساعات العمل المحتسبة: ${ms.total_hours} ساعة (${ms.total_minutes} دقيقة)`;
  }
  if (q.includes('إجاز') || q.includes('اجاز') || q.includes('طلب')) {
    const ls = context.leave_summary;
    if (!ls || !ls.total_requests) return 'لا توجد لديك طلبات إجازة مسجلة حتى الآن. يمكنك تقديم طلب من تبويب «طلب إجازة واستئذان».';
    const latest = ls.latest_request;
    const stLabel = latest?.status === 'approved' ? 'مقبولة' : latest?.status === 'rejected' ? 'مرفوضة' : 'قيد المراجعة';
    return `ملخص إجازاتك (${ls.total_requests} طلبات):\n• مقبولة: ${ls.approved_count} | قيد المراجعة: ${ls.pending_count}\n• آخر طلب: من ${latest.from_date} إلى ${latest.to_date} (${stLabel})`;
  }
  if (q.includes('بصم') || q.includes('كيف') || q.includes('موقع') || q.includes('qr')) {
    return user.is_remote
      ? 'حسابك مضبوط على الدوام عن بعد: اضغط زر «تسجيل الحضور بالبصمة» وسيتم التحقق من بصمة الجهاز وتسجيل حضورك مباشرة.'
      : 'لتسجيل الحضور بالمقر: تأكد من تفعيل الموقع الجغرافي (GPS) داخل نطاق الفرع، ثم استخدم زر «تسجيل الحضور بالبصمة» أو امسح رمز QR المعتمد.';
  }
  const att = context.today_attendance;
  const statusStr = att.state === 'inside'
    ? `على رأس العمل (دخول ${att.first_in}${att.late_minutes ? ` · تأخير ${att.late_minutes} د` : ''})`
    : att.state === 'outside' || att.state === 'closed'
      ? `تم تسجيل انصرافك اليوم (دخول ${att.first_in} · خروج ${att.last_out})`
      : 'لم تسجل حضورك اليوم بعد';
  const hoursSuffix = context.monthly_summary ? `\nإجمالي ساعاتك هذا الشهر: ${context.monthly_summary.total_hours} ساعة` : '';
  return `حالتك اليوم (${context.date}): ${statusStr}.${hoursSuffix}`;
}

function sanitizeAiReply(text) {
  const cleaned = String(text || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
  return cleaned.slice(0, 1400);
}

function verifyReplyNumbersGrounded(reply, context, verifiedAnswer) {
  const allowedText = `${JSON.stringify(context)} ${verifiedAnswer}`;
  const allowedNums = new Set(allowedText.match(/\d+(?:\.\d+)?/g) || []);
  const replyNums = reply.match(/\d+(?:\.\d+)?/g) || [];
  for (const n of replyNums) {
    if (!allowedNums.has(n)) {
      return false;
    }
  }
  return true;
}

async function callFreeLlm({ apiUrl, apiKey, model, messages, maxTokens = 450, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('FETCH_UNAVAILABLE');
  }

  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let lastErr = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetchImpl(apiUrl, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(12000),
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          temperature: 0.1
        })
      });

      if (response.status === 402 || response.status === 429 || response.status >= 500) {
        lastErr = new Error(`AI_UPSTREAM_${response.status}`);
        continue;
      }
      if (!response.ok) {
        throw new Error(`AI_HTTP_${response.status}`);
      }

      const data = await response.json();
      const rawContent = data?.choices?.[0]?.message?.content;
      const content = sanitizeAiReply(rawContent);
      if (!content) {
        throw new Error('AI_EMPTY_REPLY');
      }
      return { content, model: data?.model || model };
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr || new Error('AI_PROVIDER_UNAVAILABLE');
}

async function askAssistant({ user, history = [], question, helpers, fetchImpl = globalThis.fetch }) {
  const effectivePolicy = await getEffectiveUserPolicy(user);
  if (!effectivePolicy.enabled) {
    throw new AppError('ASSISTANT_DISABLED', 'تم إيقاف المساعد الذكي لهذا الحساب من قِبل الإدارة.', 403);
  }

  const cleanQuestion = String(question || '').trim();
  if (!cleanQuestion) {
    throw new AppError('VALIDATION', 'يرجى كتابة سؤالك أولاً.', 400);
  }
  if (cleanQuestion.length > effectivePolicy.max_chars) {
    throw new AppError('VALIDATION', `طول الرسالة يتجاوز الحد المسموح (${effectivePolicy.max_chars} حرف).`, 400);
  }

  const day = policyEngine.localDay();
  const usage = await getDailyUsage(user.id, day);
  if (usage.questions_count >= effectivePolicy.daily_limit) {
    throw new AppError(
      'ASSISTANT_QUOTA_EXCEEDED',
      `تجاوزت الحصة اليومية المسموح بها للمساعد (${effectivePolicy.daily_limit} سؤال اليوم). تتجدد الحصة غداً.`,
      429
    );
  }

  const check = classifyAndValidateQuestion(cleanQuestion, user, effectivePolicy);
  if (check.blocked) {
    await recordUsage(user.id, day, true);
    const updatedUsage = await getDailyUsage(user.id, day);
    return {
      reply: check.reply,
      meta: {
        blocked: true,
        restriction_reason: check.reason,
        used_ai: false,
        quota: {
          used: updatedUsage.questions_count,
          limit: effectivePolicy.daily_limit,
          remaining: Math.max(0, effectivePolicy.daily_limit - updatedUsage.questions_count)
        }
      }
    };
  }

  const context = await buildGroundedContext(user, effectivePolicy, helpers);
  const verifiedAnswer = buildDeterministicReply(cleanQuestion, user, effectivePolicy, context);
  const chain = resolveProviderChain(effectivePolicy.globals);
  const systemBase = loadPromptTemplate();
  const customRuleBlock = effectivePolicy.custom_note
    ? `\n\nتوجيه إداري مخصص لهذا المستخدم:\n${effectivePolicy.custom_note}`
    : '';

  const messages = [
    {
      role: 'system',
      content: `${systemBase}${customRuleBlock}\n\n[AUTHORIZED_CONTEXT]\n${JSON.stringify(context)}\n\n[VERIFIED_ANSWER]\n${verifiedAnswer}`
    },
    ...history
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-6, -1)
      .map(m => ({ role: m.role, content: String(m.content).slice(0, 600) })),
    {
      role: 'system',
      content: 'اعتمد الأرقام والحقائق من [VERIFIED_ANSWER] و[AUTHORIZED_CONTEXT] حرفياً وأجب باختصار بالعربية فقط دون تغيير أي رقم.'
    },
    {
      role: 'user',
      content: cleanQuestion
    }
  ];

  let reply = verifiedAnswer;
  let usedAi = false;
  let activeProvider = chain[0];
  let actualModel = chain[0].model;

  for (const candidate of chain) {
    try {
      const llmRes = await callFreeLlm({
        apiUrl: candidate.apiUrl,
        apiKey: candidate.apiKey,
        model: candidate.model,
        messages,
        fetchImpl
      });
      if (verifyReplyNumbersGrounded(llmRes.content, context, verifiedAnswer)) {
        reply = llmRes.content;
        activeProvider = candidate;
        actualModel = llmRes.model;
        usedAi = true;
        break;
      }
      console.warn(`[Assistant AI number-guard fallback] provider=${candidate.name} deviated from verified numbers`);
      activeProvider = candidate;
      break;
    } catch (err) {
      console.warn(`[Assistant AI fallback] provider=${candidate.name} reason=${err.message}`);
    }
  }

  await recordUsage(user.id, day, false);
  const updatedUsage = await getDailyUsage(user.id, day);

  return {
    reply,
    meta: {
      blocked: false,
      used_ai: usedAi,
      provider: activeProvider.name,
      model: actualModel,
      prompt_version: PROMPT_VERSION,
      quota: {
        used: updatedUsage.questions_count,
        limit: effectivePolicy.daily_limit,
        remaining: Math.max(0, effectivePolicy.daily_limit - updatedUsage.questions_count)
      }
    }
  };
}

async function getAssistantStatusForUser(user) {
  const effective = await getEffectiveUserPolicy(user);
  const usage = await getDailyUsage(user.id);
  const provider = resolveLlmProvider(effective.globals);
  return {
    enabled: effective.enabled,
    reason: !effective.globalEnabled
      ? 'تم إيقاف المساعد الذكي على مستوى النظام.'
      : !effective.enabled
        ? 'تم إيقاف المساعد الذكي لهذا الحساب من قِبل الإدارة.'
        : null,
    quota: {
      used: usage.questions_count,
      limit: effective.daily_limit,
      remaining: Math.max(0, effective.daily_limit - usage.questions_count),
      blocked_today: usage.blocked_count
    },
    restrictions: {
      allow_hours_info: effective.allow_hours_info,
      allow_leave_info: effective.allow_leave_info,
      allow_team_data: effective.allow_team_data,
      allow_general_help: effective.allow_general_help,
      strict_topic_only: effective.strict_topic_only,
      max_chars: effective.max_chars,
      has_blocked_keywords: Boolean(effective.blocked_keywords)
    },
    provider: {
      name: provider.name,
      model: provider.model,
      free: provider.free
    }
  };
}

async function getUserPolicyAdminView(accountId) {
  const acc = (await db.query('SELECT id, name, identifier, role FROM accounts WHERE id=$1', [accountId])).rows[0];
  if (!acc) throw new AppError('NOT_FOUND', 'الحساب غير موجود', 404);
  const row = (await db.query('SELECT * FROM assistant_user_policies WHERE account_id=$1', [accountId])).rows[0] || null;
  const usage = await getDailyUsage(accountId);
  return {
    account_id: acc.id,
    name: acc.name,
    role: acc.role,
    enabled: row ? Boolean(row.enabled) : true,
    daily_limit: row?.daily_limit ?? null,
    allow_hours_info: row ? Boolean(row.allow_hours_info) : true,
    allow_leave_info: row ? Boolean(row.allow_leave_info) : true,
    allow_team_data: acc.role === 'employee' ? false : (row ? Boolean(row.allow_team_data) : true),
    allow_general_help: row ? Boolean(row.allow_general_help) : true,
    strict_topic_only: row ? Boolean(row.strict_topic_only) : true,
    blocked_keywords: row?.blocked_keywords || '',
    custom_note: row?.custom_note || '',
    usage_today: usage
  };
}

async function saveUserPolicyAdmin(accountId, actor, payload = {}) {
  const acc = (await db.query('SELECT id, role FROM accounts WHERE id=$1', [accountId])).rows[0];
  if (!acc) throw new AppError('NOT_FOUND', 'الحساب غير موجود', 404);

  const enabled = payload.enabled === undefined ? true : Boolean(payload.enabled);
  let dailyLimit = null;
  if (payload.daily_limit !== undefined && payload.daily_limit !== null && payload.daily_limit !== '') {
    const parsed = Number(payload.daily_limit);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 2000) {
      throw new AppError('VALIDATION', 'الحد اليومي للمساعد يجب أن يكون عدداً صحيحاً بين 0 و 2000', 400);
    }
    dailyLimit = parsed;
  }

  const allowHours = payload.allow_hours_info === undefined ? true : Boolean(payload.allow_hours_info);
  const allowLeave = payload.allow_leave_info === undefined ? true : Boolean(payload.allow_leave_info);
  const allowTeam = acc.role === 'employee' ? false : (payload.allow_team_data === undefined ? true : Boolean(payload.allow_team_data));
  const allowGeneral = payload.allow_general_help === undefined ? true : Boolean(payload.allow_general_help);
  const strictTopic = payload.strict_topic_only === undefined ? true : Boolean(payload.strict_topic_only);
  const blockedKeywords = String(payload.blocked_keywords || '').trim().slice(0, 500);
  const customNote = String(payload.custom_note || '').trim().slice(0, 400);

  await db.query(
    `INSERT INTO assistant_user_policies(
       account_id, enabled, daily_limit, allow_hours_info, allow_leave_info,
       allow_team_data, allow_general_help, strict_topic_only, blocked_keywords, custom_note, updated_at
     ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,strftime('%Y-%m-%dT%H:%M:%fZ','now'))
     ON CONFLICT(account_id) DO UPDATE SET
       enabled = EXCLUDED.enabled,
       daily_limit = EXCLUDED.daily_limit,
       allow_hours_info = EXCLUDED.allow_hours_info,
       allow_leave_info = EXCLUDED.allow_leave_info,
       allow_team_data = EXCLUDED.allow_team_data,
       allow_general_help = EXCLUDED.allow_general_help,
       strict_topic_only = EXCLUDED.strict_topic_only,
       blocked_keywords = EXCLUDED.blocked_keywords,
       custom_note = EXCLUDED.custom_note,
       updated_at = EXCLUDED.updated_at`,
    [accountId, enabled, dailyLimit, allowHours, allowLeave, allowTeam, allowGeneral, strictTopic, blockedKeywords, customNote]
  );

  return getUserPolicyAdminView(accountId);
}

module.exports = {
  PROMPT_VERSION,
  FIXED_REFUSALS,
  isSafeLlmUrl,
  loadGlobalAssistantSettings,
  resolveLlmProvider,
  resolveProviderChain,
  getEffectiveUserPolicy,
  getDailyUsage,
  classifyAndValidateQuestion,
  buildGroundedContext,
  verifyReplyNumbersGrounded,
  callFreeLlm,
  askAssistant,
  getAssistantStatusForUser,
  getUserPolicyAdminView,
  saveUserPolicyAdmin
};
