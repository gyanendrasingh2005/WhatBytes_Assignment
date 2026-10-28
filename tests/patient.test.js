const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

// Create test JWT token
const testUser = { id: 1, email: 'test@example.com' };
const validToken = jwt.sign(testUser, process.env.JWT_SECRET || 'healthcare_super_secret_jwt_key_2026_change_in_production', {
  subject: '1',
  expiresIn: '1h',
});

// Mock Prisma client to test controllers in isolation without needing live PostgreSQL
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
    patient: {
      create: jest.fn().mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 101,
          ...data,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 101,
          name: 'Rahul Sharma',
          age: 28,
          gender: 'Male',
          address: 'Delhi, India',
          phone: '9876543210',
          medicalHistory: 'None',
          createdById: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]),
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 101) {
          return Promise.resolve({
            id: 101,
            name: 'Rahul Sharma',
            age: 28,
            gender: 'Male',
            address: 'Delhi, India',
            phone: '9876543210',
            medicalHistory: 'None',
            createdById: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
            doctors: [],
          });
        }
        if (where.id === 202) {
          // Patient belonging to another user (User 2)
          return Promise.resolve({
            id: 202,
            name: 'Other Patient',
            age: 45,
            gender: 'Female',
            address: 'Mumbai',
            phone: '9123456789',
            createdById: 2,
            doctors: [],
          });
        }
        return Promise.resolve(null);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        return Promise.resolve({
          id: where.id,
          name: data.name || 'Rahul Sharma',
          age: data.age || 29,
          gender: 'Male',
          address: 'Delhi, India',
          phone: '9876543210',
          medicalHistory: data.medicalHistory || 'None',
          createdById: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }),
      delete: jest.fn().mockResolvedValue({ id: 101 }),
    },
    $transaction: jest.fn().mockImplementation(async (callback) => {
      const mockTx = {
        patientDoctor: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
        patient: { delete: jest.fn().mockResolvedValue({ id: 101 }) },
      };
      return callback(mockTx);
    }),
  };
});

describe('Patient APIs & Ownership Enforcement', () => {
  describe('POST /api/patients', () => {
    it('should successfully create a patient with valid authentication and payload', async () => {
      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Rahul Sharma',
          age: 28,
          gender: 'Male',
          address: 'Delhi, India',
          phone: '9876543210',
          medicalHistory: 'No known allergies',
        });

      expect(res.statusCode).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('Rahul Sharma');
      expect(res.body.data.createdById).toBe(1);
    });

    it('should reject creation when age is invalid (negative)', async () => {
      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Rahul Sharma',
          age: -10,
          gender: 'Male',
          address: 'Delhi, India',
          phone: '9876543210',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/valid integer between 0 and 150/i);
    });

    it('should reject creation when gender is unsupported', async () => {
      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Rahul Sharma',
          age: 28,
          gender: 'InvalidGender',
          address: 'Delhi, India',
          phone: '9876543210',
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Gender must be one of/i);
    });

    it('should reject creation when unexpected client fields are supplied (e.g. createdById injection)', async () => {
      const res = await request(app)
        .post('/api/patients')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          name: 'Rahul Sharma',
          age: 28,
          gender: 'Male',
          address: 'Delhi, India',
          phone: '9876543210',
          createdById: 999, // Should be rejected
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Unexpected fields not permitted/i);
    });
  });

  describe('GET /api/patients', () => {
    it('should retrieve patients owned by the authenticated user', async () => {
      const res = await request(app)
        .get('/api/patients')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('GET /api/patients/:id', () => {
    it('should retrieve patient details for owned patient', async () => {
      const res = await request(app)
        .get('/api/patients/101')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(101);
    });

    it('should return 404 when accessing another user patient (ownership concealment)', async () => {
      const res = await request(app)
        .get('/api/patients/202')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Patient not found');
    });

    it('should reject non-integer patient ID with 400', async () => {
      const res = await request(app)
        .get('/api/patients/abc')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('PUT /api/patients/:id', () => {
    it('should update owned patient successfully', async () => {
      const res = await request(app)
        .put('/api/patients/101')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          age: 29,
          medicalHistory: 'Updated allergies',
        });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('should return 404 when attempting to update another user patient', async () => {
      const res = await request(app)
        .put('/api/patients/202')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          age: 50,
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('DELETE /api/patients/:id', () => {
    it('should delete owned patient successfully', async () => {
      const res = await request(app)
        .delete('/api/patients/101')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/deleted successfully/i);
    });

    it('should return 404 when attempting to delete another user patient', async () => {
      const res = await request(app)
        .delete('/api/patients/202')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
