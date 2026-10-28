const request = require('supertest');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = require('../src/app');

// Mock variable prefixed with 'mock' is allowed by Jest
const mockUsers = [
  {
    id: 1,
    name: 'Existing User',
    email: 'existing@example.com',
    password: bcrypt.hashSync('StrongPassword123', 10),
    createdAt: new Date(),
  },
];

jest.mock('../src/config/prisma', () => {
  return {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        const found = mockUsers.find((u) => u.email === where.email || u.id === where.id);
        return Promise.resolve(found ? { ...found } : null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        const newUser = {
          id: mockUsers.length + 1,
          name: data.name,
          email: data.email,
          password: data.password,
          createdAt: new Date(),
        };
        mockUsers.push(newUser);
        return Promise.resolve(newUser);
      }),
    },
    patient: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  };
});

describe('Authentication API & Middleware Validation', () => {
  describe('POST /api/auth/register', () => {
    it('Test A: Successful registration should return 201 and safe user info without password', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test User One',
        email: 'testuser1@example.com',
        password: 'TestPassword123!',
      });
      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.name).toBe('Test User One');
      expect(res.body.data.email).toBe('testuser1@example.com');
      expect(res.body.data.password).toBeUndefined();
    });

    it('Test B: Duplicate registration should return 409 Conflict', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Duplicate User',
        email: 'existing@example.com',
        password: 'TestPassword123!',
      });
      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('Test C: Missing fields should return 400 with validation message', async () => {
      const res = await request(app).post('/api/auth/register').send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBeDefined();
      expect(res.body.errors).toBeDefined();
    });

    it('Test D: Invalid email should return 400', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'invalid-email-format',
        password: 'ValidPassword123',
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/valid email/i);
    });

    it('Test E: Weak password should return 400', async () => {
      const res = await request(app).post('/api/auth/register').send({
        name: 'Test User',
        email: 'weakpass@example.com',
        password: 'onlyletters',
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Password must contain at least one letter and at least one number/i);
    });

    it('Test F: Password security - password must be hashed with bcrypt before storing', async () => {
      const prisma = require('../src/config/prisma');
      const registered = await prisma.user.findUnique({ where: { email: 'testuser1@example.com' } });
      expect(registered).toBeDefined();
      expect(registered.password).not.toBe('TestPassword123!');
      expect(registered.password).toMatch(/^\$2[aby]\$/); // Standard bcrypt hash format
      const isMatch = await bcrypt.compare('TestPassword123!', registered.password);
      expect(isMatch).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    it('Test A: Successful login should return 200 with JWT access token and user info', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'existing@example.com',
        password: 'StrongPassword123',
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('existing@example.com');
      expect(res.body.data.user.password).toBeUndefined();
    });

    it('Test B: Incorrect password should return 401 Unauthorized', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'existing@example.com',
        password: 'WrongPassword999',
      });
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid email or password/i);
    });

    it('Test C: Unregistered email should return 401 Unauthorized', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@example.com',
        password: 'Password123!',
      });
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid email or password/i);
    });

    it('Test D: Missing credentials should return 400', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('Test E: Missing password should return 400', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'existing@example.com',
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('JWT Authentication Middleware', () => {
    it('Test A: Request with no Authorization header should return 401', async () => {
      const res = await request(app).get('/api/patients');
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Authorization token is required/i);
    });

    it('Test B: Request with invalid Authorization token should return 401', async () => {
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', 'Bearer invalid.tampered.token');
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid authorization token/i);
    });

    it('Test C: Request with expired Authorization token should return 401', async () => {
      const secret = process.env.JWT_SECRET || 'healthcare_super_secret_jwt_key_2026_change_in_production';
      const expiredToken = jwt.sign({ id: 1, email: 'test@example.com' }, secret, {
        expiresIn: '-10s',
      });
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${expiredToken}`);
      expect(res.statusCode).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Invalid authorization token/i);
    });

    it('Test D: Request with valid Authorization token proceeds to protected route', async () => {
      const secret = process.env.JWT_SECRET || 'healthcare_super_secret_jwt_key_2026_change_in_production';
      const validToken = jwt.sign({ id: 1, email: 'existing@example.com' }, secret, {
        expiresIn: '1h',
      });
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${validToken}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
