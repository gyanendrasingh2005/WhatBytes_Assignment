const request = require('supertest');
const app = require('../src/app');

describe('Health and Not Found APIs', () => {
  it('GET /api/health should return 200 with running message', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: 'Healthcare API is running',
    });
  });

  it('GET /api/nonexistent-route should return 404 with error message', async () => {
    const res = await request(app).get('/api/nonexistent-route');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Resource not found/);
  });
});
