'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

// Mock simulation of device-binding logic matching backend/src/secure-app.js
class MockAccountStore {
  constructor() {
    this.accounts = [];
  }

  addAccount(acc) {
    this.accounts.push({
      id: acc.id,
      identifier: acc.identifier,
      name: acc.name,
      email: acc.email ? acc.email.toLowerCase().trim() : null,
      phone: acc.phone || null,
      role: acc.role || 'employee',
      bound_device_id: acc.bound_device_id || null,
      bound_device_name: acc.bound_device_name || null,
      device_bound_at: acc.device_bound_at || null
    });
  }

  async login(identifierOrEmail, deviceId, deviceName, phone) {
    const target = identifierOrEmail.toLowerCase().trim();
    const account = this.accounts.find(
      a => a.identifier.toLowerCase() === target || (a.email && a.email === target)
    );
    if (!account) throw new Error('بيانات الدخول غير صحيحة');

    if (account.role === 'employee' && deviceId) {
      // 1. Device cannot be used by another employee
      const otherBound = this.accounts.find(
        a => a.bound_device_id === deviceId && a.id !== account.id
      );
      if (otherBound) {
        throw new Error(`DEVICE_BOUND_OTHER: هذا الجوال مقترن بالموظف (${otherBound.name})`);
      }

      // 2. Account locked to a single device
      if (account.bound_device_id && account.bound_device_id !== deviceId) {
        throw new Error(`DEVICE_MISMATCH: حسابك مقترن بجهاز آخر (${account.bound_device_name})`);
      }

      // 3. First login binds device and phone
      if (!account.bound_device_id) {
        account.bound_device_id = deviceId;
        account.bound_device_name = deviceName || 'هاتف ذكي';
        account.device_bound_at = new Date();
        if (!account.phone && phone) account.phone = phone;
      }
    }

    return account;
  }

  async resetDevice(accountId) {
    const account = this.accounts.find(a => a.id === accountId);
    if (!account) throw new Error('الحساب غير موجود');
    account.bound_device_id = null;
    account.bound_device_name = null;
    account.device_bound_at = null;
    return true;
  }
}

test('Email login: matches by either username or email case-insensitively', async () => {
  const store = new MockAccountStore();
  store.addAccount({ id: 1, identifier: 'emp1', name: 'أحمد علي', email: 'ahmed@company.ye', phone: '771234567' });

  // Login by username
  const acc1 = await store.login('emp1', 'dev-1', 'iPhone 15');
  assert.equal(acc1.name, 'أحمد علي');

  // Login by email uppercase
  const acc2 = await store.login('AHMED@company.ye', 'dev-1', 'iPhone 15');
  assert.equal(acc2.id, 1);
});

test('Device binding: auto-binds phone and device_id on first login', async () => {
  const store = new MockAccountStore();
  store.addAccount({ id: 2, identifier: 'emp2', name: 'سالم محمد', email: 'salem@company.ye' });

  const acc = await store.login('salem@company.ye', 'device-phone-xyz', 'Samsung Galaxy S24', '770000002');
  assert.equal(acc.bound_device_id, 'device-phone-xyz');
  assert.equal(acc.bound_device_name, 'Samsung Galaxy S24');
  assert.equal(acc.phone, '770000002');
  assert.ok(acc.device_bound_at instanceof Date);
});

test('Anti-Fraud Lock 1: Another employee CANNOT log in from the same device', async () => {
  const store = new MockAccountStore();
  // Employee 1 is already bound to device-iphone-001
  store.addAccount({ id: 1, identifier: 'emp1', name: 'أحمد علي', email: 'ahmed@company.ye', bound_device_id: 'device-iphone-001' });
  // Employee 2 is a new employee
  store.addAccount({ id: 2, identifier: 'emp2', name: 'خالد عمر', email: 'khaled@company.ye' });

  // Employee 2 tries to log in on Employee 1's iPhone
  await assert.rejects(
    async () => {
      await store.login('khaled@company.ye', 'device-iphone-001', 'iPhone 15');
    },
    /DEVICE_BOUND_OTHER: هذا الجوال مقترن بالموظف \(أحمد علي\)/
  );
});

test('Anti-Fraud Lock 2: Employee cannot log in from a second phone unless reset', async () => {
  const store = new MockAccountStore();
  store.addAccount({
    id: 1,
    identifier: 'emp1',
    name: 'أحمد علي',
    email: 'ahmed@company.ye',
    bound_device_id: 'device-iphone-001',
    bound_device_name: 'iPhone 14 Pro'
  });

  // Employee 1 tries to log in from a friend's phone
  await assert.rejects(
    async () => {
      await store.login('emp1', 'device-random-999', 'Xiaomi Redmi');
    },
    /DEVICE_MISMATCH: حسابك مقترن بجهاز آخر \(iPhone 14 Pro\)/
  );

  // Admin resets the device
  await store.resetDevice(1);

  // Now employee can bind the new phone
  const updated = await store.login('emp1', 'device-new-iphone-15', 'iPhone 15 Pro');
  assert.equal(updated.bound_device_id, 'device-new-iphone-15');
});
