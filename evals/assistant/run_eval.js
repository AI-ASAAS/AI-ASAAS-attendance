'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const assistant = require('../../backend/src/services/assistant.service');

const casesPath = path.join(__dirname, 'cases.json');
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf8'));

const defaultPolicy = {
  enabled: true,
  daily_limit: 20,
  allow_hours_info: true,
  allow_leave_info: true,
  allow_team_data: false,
  allow_general_help: true,
  strict_topic_only: true,
  blocked_keywords: ''
};

let passed = 0;
let failed = 0;

for (const c of cases) {
  try {
    const res = assistant.classifyAndValidateQuestion(
      c.question,
      { id: 1, role: c.role },
      defaultPolicy
    );
    assert.equal(res.blocked, c.expected_blocked, `Expected blocked=${c.expected_blocked}, got ${res.blocked}`);
    if (c.expected_reason) {
      assert.equal(res.reason, c.expected_reason, `Expected reason=${c.expected_reason}, got ${res.reason}`);
    }
    passed++;
    console.log(`✔ [${c.id}] (${c.category}) passed`);
  } catch (err) {
    failed++;
    console.error(`✘ [${c.id}] (${c.category}) failed:`, err.message);
  }
}

// Grounded number guard checks
try {
  const ctx = { hours: 8, minutes: 30, count: 2 };
  const verified = 'ساعات دوامك اليوم 8 ساعات و30 دقيقة.';
  assert.equal(assistant.verifyReplyNumbersGrounded('داومت 8 ساعات و30 دقيقة.', ctx, verified), true);
  assert.equal(assistant.verifyReplyNumbersGrounded('داومت 14 ساعة اليوم.', ctx, verified), false);
  passed++;
  console.log('✔ [guard-numbers] passed');
} catch (err) {
  failed++;
  console.error('✘ [guard-numbers] failed:', err.message);
}

// SSRF URL checks
try {
  assert.equal(assistant.isSafeLlmUrl('https://api.llm7.io/v1/chat/completions'), true);
  assert.equal(assistant.isSafeLlmUrl('https://169.254.169.254/latest/meta-data'), false);
  assert.equal(assistant.isSafeLlmUrl('https://192.168.1.1/api'), false);
  passed++;
  console.log('✔ [guard-ssrf] passed');
} catch (err) {
  failed++;
  console.error('✘ [guard-ssrf] failed:', err.message);
}

console.log(`\nAssistant Eval Summary: ${passed} passed, ${failed} failed (prompt=${assistant.PROMPT_VERSION})`);
process.exit(failed > 0 ? 1 : 0);
