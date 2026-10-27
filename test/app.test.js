process.env.NODE_ENV='test';
process.env.PORT='3000';
process.env.DATABASE_URL='postgresql://postgres:postgres@localhost:5432/telemed';
process.env.JWT_SECRET='nikhilprjpt15Januarytelemedsolution';
process.env.JWT_ISSUER='telemed-api';
process.env.JWT_AUDIENCE='telemed-clients';
process.env.CORS_ORIGIN='http://localhost:5173';
const request = require('supertest');
const app = require('../src/app');
describe('health and API safety', () => {
  test('liveness returns ok without DB access', async () => {
    const res = await request(app).get('/health/live');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
  test('unknown endpoint returns structured 404', async () => {
    const res = await request(app).get('/no-such-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error.requestId).toBeTruthy();
  });
  test('protected endpoint rejects missing token', async () => {
    const res = await request(app).get('/api/v1/consultations/mine');
    expect(res.status).toBe(401);
  });
});
