'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const app = require('../src/secure-app');

test('API Error Shape & Security Boundaries: 404 returns standard { message } body', async () => {
  const res = await request(app).get('/non-existent-route-check');
  assert.equal(res.status, 404);
  assert.equal(res.body.success, false);
  assert.equal(typeof res.body.message, 'string');
  assert.ok(res.body.message.length > 0);
});

test('API Error Shape & Security Boundaries: 401 unauthenticated /api/auth/me returns { message }', async () => {
  const res = await request(app).get('/api/auth/me');
  assert.equal(res.status, 401);
  assert.equal(res.body.success, false);
  assert.equal(typeof res.body.message, 'string');
});

test('API Error Shape & Security Boundaries: rejects Origin: null on state-changing requests', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', 'null')
    .send({ identifier: 'test', password: 'test' });
  assert.equal(res.status, 403);
  assert.equal(res.body.success, false);
  assert.equal(typeof res.body.message, 'string');
});

test('API Error Shape & Security Boundaries: rejects non-JSON POST with 415 { message }', async () => {
  const res = await request(app)
    .post('/api/auth/login')
    .set('Origin', 'http://localhost:3000')
    .set('Content-Type', 'text/plain')
    .send('invalid');
  assert.equal(res.status, 415);
  assert.equal(res.body.success, false);
  assert.equal(typeof res.body.message, 'string');
});
