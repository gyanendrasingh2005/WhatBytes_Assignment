const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../src/app');

const secret = process.env.JWT_SECRET || 'healthcare_super_secret_jwt_key_2026_change_in_production';

// User 1 (Primary User)
const tokenUserOne = jwt.sign({ id: 1, email: 'user1@example.com' }, secret, {
  subject: '1',
  expiresIn: '1h',
});

// User 2 (Secondary User)
const tokenUserTwo = jwt.sign({ id: 2, email: 'user2@example.com' }, secret, {
  subject: '2',
  expiresIn: '1h',
});

// Mock Prisma client with records for both User 1 and User 2
jest.mock('../src/config/prisma', () => {
  return {
    patient: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 10) {
          // Patient owned by User 1
          return Promise.resolve({
            id: 10,
            name: 'Patient of User 1',
            age: 25,
            gender: 'Male',
            address: 'Delhi',
            phone: '9876543210',
            createdById: 1,
            doctors: [],
          });
        }
        if (where.id === 20) {
          // Patient owned by User 2
          return Promise.resolve({
            id: 20,
            name: 'Patient of User 2',
            age: 40,
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
        return Promise.resolve({ id: where.id, ...data });
      }),
      delete: jest.fn().mockResolvedValue({ id: 20 }),
    },
    doctor: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.id === 100) {
          // Doctor created by User 1
          return Promise.resolve({
            id: 100,
            name: 'Dr. One',
            specialization: 'Cardiology',
            email: 'doc1@example.com',
            phone: '9876543201',
            createdById: 1,
          });
        }
        if (where.id === 200) {
          // Doctor created by User 2
          return Promise.resolve({
            id: 200,
            name: 'Dr. Two',
            specialization: 'Neurology',
            email: 'doc2@example.com',
            phone: '9876543202',
            createdById: 2,
          });
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockResolvedValue([
        { id: 100, name: 'Dr. One', specialization: 'Cardiology', createdById: 1 },
        { id: 200, name: 'Dr. Two', specialization: 'Neurology', createdById: 2 },
      ]),
      update: jest.fn().mockImplementation(({ where, data }) => {
        return Promise.resolve({ id: where.id, ...data });
      }),
      delete: jest.fn().mockResolvedValue({ id: 200 }),
    },
    patientDoctor: {
      findUnique: jest.fn().mockImplementation(({ where }) => {
        if (where.patientId_doctorId_unique) {
          return Promise.resolve(null);
        }
        if (where.id === 500) {
          // Mapping created by User 2
          return Promise.resolve({
            id: 500,
            patientId: 20,
            doctorId: 200,
            createdById: 2,
          });
        }
        return Promise.resolve(null);
      }),
      findMany: jest.fn().mockImplementation(({ where }) => {
        if (where.createdById === 1) {
          return Promise.resolve([]);
        }
        if (where.createdById === 2) {
          return Promise.resolve([
            { id: 500, patientId: 20, doctorId: 200, createdById: 2 },
          ]);
        }
        return Promise.resolve([]);
      }),
      delete: jest.fn().mockResolvedValue({ id: 500 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
});

describe('Cross-User Authorization & Security Isolation (Section 9)', () => {
  describe('Patient Ownership Isolation between User 1 and User 2', () => {
    it('User 1 attempting to retrieve User 2 patient should be rejected with 404', async () => {
      const res = await request(app)
        .get('/api/patients/20')
        .set('Authorization', `Bearer ${tokenUserOne}`);
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Patient not found');
    });

    it('User 1 attempting to update User 2 patient should be rejected with 404', async () => {
      const res = await request(app)
        .put('/api/patients/20')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .send({ age: 99 });
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Patient not found');
    });

    it('User 1 attempting to delete User 2 patient should be rejected with 404', async () => {
      const res = await request(app)
        .delete('/api/patients/20')
        .set('Authorization', `Bearer ${tokenUserOne}`);
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Patient not found');
    });

    it('User 2 can access their own patient successfully', async () => {
      const res = await request(app)
        .get('/api/patients/20')
        .set('Authorization', `Bearer ${tokenUserTwo}`);
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(20);
    });
  });

  describe('Mapping Authorization between User 1 and User 2', () => {
    it('User 1 attempting to assign a doctor to User 2 patient should be rejected with 404', async () => {
      const res = await request(app)
        .post('/api/mappings')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .send({
          patientId: 20, // Owned by User 2
          doctorId: 100,
        });
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Patient not found or you do not have permission/i);
    });

    it('User 1 attempting to retrieve doctors for User 2 patient should be rejected with 404', async () => {
      const res = await request(app)
        .get('/api/mappings/20')
        .set('Authorization', `Bearer ${tokenUserOne}`);
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Patient not found');
    });

    it('User 1 attempting to delete User 2 mapping should be rejected with 404', async () => {
      const res = await request(app)
        .delete('/api/mappings/500')
        .set('Authorization', `Bearer ${tokenUserOne}`);
      expect(res.statusCode).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Patient-doctor assignment not found/i);
    });
  });

  describe('Doctor Permissions between User 1 and User 2', () => {
    it('Both User 1 and User 2 can read the global list of registered doctors', async () => {
      const res1 = await request(app)
        .get('/api/doctors')
        .set('Authorization', `Bearer ${tokenUserOne}`);
      expect(res1.statusCode).toBe(200);

      const res2 = await request(app)
        .get('/api/doctors')
        .set('Authorization', `Bearer ${tokenUserTwo}`);
      expect(res2.statusCode).toBe(200);
    });

    it('User 1 attempting to update User 2 doctor should be rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .put('/api/doctors/200')
        .set('Authorization', `Bearer ${tokenUserOne}`)
        .send({ specialization: 'Hacked Specialization' });
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    it('User 1 attempting to delete User 2 doctor should be rejected with 403 Forbidden', async () => {
      const res = await request(app)
        .delete('/api/doctors/200')
        .set('Authorization', `Bearer ${tokenUserOne}`);
      expect(res.statusCode).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Forbidden/i);
    });

    it('User 2 can update their own doctor successfully', async () => {
      const res = await request(app)
        .put('/api/doctors/200')
        .set('Authorization', `Bearer ${tokenUserTwo}`)
        .send({ specialization: 'Pediatric Neurology' });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
