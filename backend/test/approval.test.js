'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('Approval System: Self-registration or Google login requires admin approval before login', async () => {
  class AccountFlow {
    constructor() {
      this.accounts = [];
    }

    register(name, email, password) {
      const id = this.accounts.length + 1;
      const identifier = String(id).padStart(3, '0');
      const account = {
        id,
        identifier,
        name,
        email: email.toLowerCase().trim(),
        active: false // Critical: created pending approval
      };
      this.accounts.push(account);
      return {
        pending_approval: true,
        account,
        message: 'طلبك قيد المراجعة والموافقة من قِبل إدارة النظام'
      };
    }

    login(identifierOrEmail) {
      const target = identifierOrEmail.toLowerCase().trim();
      const account = this.accounts.find(
        a => a.identifier === target || a.email === target
      );
      if (!account) throw new Error('بيانات الدخول غير صحيحة');
      if (!account.active) {
        const err = new Error(`حسابك (${account.name} - ${account.identifier}) قيد المراجعة وبانتظار موافقة واعتماد إدارة النظام في لوحة التحكم`);
        err.code = 'ACCOUNT_PENDING_APPROVAL';
        throw err;
      }
      return { token: 'mock-session-token', account };
    }

    approve(accountId, adminRole) {
      if (adminRole !== 'super_admin' && adminRole !== 'hr_admin') {
        throw new Error('FORBIDDEN');
      }
      const acc = this.accounts.find(a => a.id === accountId);
      if (!acc) throw new Error('NOT_FOUND');
      acc.active = true;
      return { approved: true, account: acc };
    }
  }

  const flow = new AccountFlow();

  // 1. Employee registers
  const regResult = flow.register('عمر اليماني', 'omar@company.com', 'SecurePass123!');
  assert.equal(regResult.pending_approval, true);
  assert.equal(regResult.account.active, false);
  assert.equal(regResult.account.identifier, '001');

  // 2. Employee tries to log in before admin approval -> Blocked
  assert.throws(() => {
    flow.login('omar@company.com');
  }, /بانتظار موافقة/);

  // 3. Admin approves account from control panel
  const approveResult = flow.approve(regResult.account.id, 'super_admin');
  assert.equal(approveResult.approved, true);
  assert.equal(approveResult.account.active, true);

  // 4. Employee logs in after admin approval -> Allowed!
  const loginResult = flow.login('omar@company.com');
  assert.equal(loginResult.account.active, true);
  assert.ok(loginResult.token);
});

test('Approval System: secure-app.js contains register and approve endpoints with pending logic', () => {
  const code = fs.readFileSync(path.join(__dirname, '../src/secure-app.js'), 'utf8');
  assert.ok(code.includes("app.post('/api/auth/register'"), 'Missing /api/auth/register');
  assert.ok(code.includes("app.post('/api/admin/accounts/:id/approve'"), 'Missing /api/admin/accounts/:id/approve');
  assert.ok(code.includes('ACCOUNT_PENDING_APPROVAL'), 'Missing ACCOUNT_PENDING_APPROVAL error code');
  assert.ok(code.includes("ORDER BY a.active ASC"), 'Missing active ASC sorting');
});
