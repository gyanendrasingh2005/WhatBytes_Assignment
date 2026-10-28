const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

// Create test JWT token for User 1
const testUser = { id: 1, email: 'test@example.com' };
const validToken = jwt.sign(testUser, process.env.JWT_SECRET || 'healthcare_super_secret_jwt_key_2026_change_in_production', {
  subject: '1',
  expiresIn: '1h',
});

// Mock Prisma client for doctor tests
jest.mock('../src/config/prisma', () => {
  return {
    user: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 1) {
          return Promise.resolve({ id: 1, name: 'Test User', email: 'test@example.com' });
        }
        return Promise.resolve(null);
      }),
    },
    doctor: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 10) {
          // Doctor created by User 1
          return Promise.resolve({
            id: 10,
            name: 'Dr. Ananya Verma',
            specialization: 'Cardiology',
            email: 'ananya@example.com',
            phone: '9876543211',
            address: 'Noida, India',
            createdById: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        if (where.id === 20) {
          // Doctor created by User 2
          return Promise.resolve({
            id: 20,
            name: 'Dr. Other Doctor',
            specialization: 'Neurology',
            email: 'other@example.com',
            phone: '9876543222',
            address: 'Delhi',
            createdById: 2,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 10,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 10,
          name: 'Dr. Ananya Verma',
          specialization: 'Cardiology',
          email: 'ananya@example.com',
          phone: '9876543211',
          address: 'Noida, India',
          createdById: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      update: jest.fn().mockImplementation(({ where, data }) => {
        return Promise.resolve({
          id: where.id,
          name: data.name || 'Dr. Ananya Verma',
          specialization: data.specialization || 'Cardiology',
          email: data.email || 'ananya@example.com',
          phone: data.phone || '9876543211',
          address: data.address || 'Noida, India',
          createdById: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
      delete: jest.fn().mockResolvedValue({ id: 10 }),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      const mockTx = {
        patientDoctor: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        doctor: { delete: jest.fn().mockResolvedValue({ id: 10 }) },
      };
      return callback(mockTx);
    }),
  };
});

describe('Doctor APIs & Creator Authorization', () => {
  describe('POST /api/doctors', () => {
    it('should create a doctor successfully with valid payload', async () => {
      const res = await request(app)
        .post('/api/doctors')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Dr. Ananya Verma',
          specialization: 'Cardiology',
          email: 'ananya@example.com',
          phone: '9876543211',
          address: 'Noida, India',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Dr. Ananya Verma');
    });

    it('should reject creation when required specialization is missing', async () => {
      const res = await request(app)
        .post('/api/doctors')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Dr. Incomplete',
          email: 'incomplete@example.com',
          phone: '9876543211',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Specialization is required/i);
    });
  });

  describe('GET /api/doctors', () => {
    it('should allow authenticated users to retrieve all registered doctors', async () => {
      const res = await request(app)
        .get('/api/doctors')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/doctors/:id', () => {
    it('should retrieve doctor details by ID', async () => {
      const res = await request(app)
        .get('/api/doctors/10')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(10);
    });

    it('should return 404 for nonexistent doctor', async () => {
      const res = await request(app)
        .get('/api/doctors/999')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/doctors/:id permissions', () => {
    it('should update doctor when user is the creator', async () => {
      const res = await request(app)
        .put('/api/doctors/10')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          specialization: 'Interventional Cardiology',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 Forbidden when user is NOT the creator', async () => {
      const res = await request(app)
        .put('/api/doctors/20')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          specialization: 'Unauthorized Update',
        });

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });
  });

  describe('DELETE /api/doctors/:id permissions', () => {
    it('should delete doctor when user is creator', async () => {
      const res = await request(app)
        .delete('/api/doctors/10')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 403 Forbidden when user is NOT the creator', async () => {
      const res = await request(app)
        .delete('/api/doctors/20')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });
  });
});
