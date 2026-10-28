const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

// Create test JWT token for User 1
const testUser = { id: 1, email: 'test@example.com' };
const validToken = jwt.sign(testUser, process.env.JWT_SECRET || 'healthcare_super_secret_jwt_key_2026_change_in_production', {
  subject: '1',
  expiresIn: '1h',
});

// Mock Prisma client for mapping tests
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
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 1) {
          // Patient owned by user 1
          return Promise.resolve({
            id: 1,
            name: 'Rahul Sharma',
            createdById: 1,
          });
        }
        if (where.id === 99) {
          // Patient owned by user 2
          return Promise.resolve({
            id: 99,
            name: 'Other User Patient',
            createdById: 2,
          });
        }
        return Promise.resolve(null);
      }),
    },
    doctor: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 2) {
          return Promise.resolve({
            id: 2,
            name: 'Dr. Ananya Verma',
            specialization: 'Cardiology',
            email: 'ananya@example.com',
            phone: '9876543211',
          });
        }
        return Promise.resolve(null);
      }),
    },
    patientDoctor: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.patientId_doctorId_unique) {
          const { patientId, doctorId } = where.patientId_doctorId_unique;
          if (patientId === 1 && doctorId === 2) {
            // Simulate existing mapping for duplicate check test
            return Promise.resolve({ id: 50, patientId: 1, doctorId: 2, createdById: 1 });
          }
          return Promise.resolve(null);
        }
        if (where.id === 50) {
          return Promise.resolve({ id: 50, patientId: 1, doctorId: 2, createdById: 1 });
        }
        if (where.id === 60) {
          // Mapping created by user 2
          return Promise.resolve({ id: 60, patientId: 99, doctorId: 2, createdById: 2 });
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation(({ data }) => {
        return Promise.resolve({
          id: 55,
          patientId: data.patientId,
          doctorId: data.doctorId,
          createdById: data.createdById,
          createdAt: new Date(),
          patient: { id: data.patientId, name: 'Rahul Sharma', age: 28, gender: 'Male' },
          doctor: { id: data.doctorId, name: 'Dr. Ananya Verma', specialization: 'Cardiology', email: 'ananya@example.com', phone: '9876543211' },
        });
      }),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 50,
          patientId: 1,
          doctorId: 2,
          createdAt: new Date(),
          patient: { id: 1, name: 'Rahul Sharma', age: 28, gender: 'Male', phone: '9876543210' },
          doctor: { id: 2, name: 'Dr. Ananya Verma', specialization: 'Cardiology', email: 'ananya@example.com', phone: '9876543211' },
        },
      ]),
      delete: jest.fn().mockResolvedValue({ id: 50 }),
    },
  };
});

describe('Patient-Doctor Mapping APIs & Integrity', () => {
  describe('POST /api/mappings', () => {
    it('should reject mapping with invalid non-integer fields', async () => {
      const res = await request(app)
        .post('/api/mappings')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          patientId: 'invalid',
          doctorId: -1,
        });

      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should reject assigning doctor to another user patient with 404', async () => {
      const res = await request(app)
        .post('/api/mappings')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          patientId: 99, // Owned by user 2
          doctorId: 2,
        });

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Patient not found or you do not have permission/i);
    });

    it('should reject duplicate doctor assignment with 409 Conflict', async () => {
      const res = await request(app)
        .post('/api/mappings')
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          patientId: 1,
          doctorId: 2,
        });

      expect(res.statusCode).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already assigned/i);
    });
  });

  describe('GET /api/mappings', () => {
    it('should retrieve all mappings created by the authenticated user', async () => {
      const res = await request(app)
        .get('/api/mappings')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data[0].patient).toBeDefined();
      expect(res.body.data[0].doctor).toBeDefined();
    });
  });

  describe('GET /api/mappings/:patientId', () => {
    it('should return doctors assigned to owned patient', async () => {
      const res = await request(app)
        .get('/api/mappings/1')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.patient.id).toBe(1);
    });

    it('should return 404 for inaccessible patient', async () => {
      const res = await request(app)
        .get('/api/mappings/99')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Patient not found');
    });
  });

  describe('DELETE /api/mappings/:id', () => {
    it('should successfully remove mapping owned by user', async () => {
      const res = await request(app)
        .delete('/api/mappings/50')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/removed successfully/i);
    });

    it('should return 404 when attempting to delete another user mapping', async () => {
      const res = await request(app)
        .delete('/api/mappings/60')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
