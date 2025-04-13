import request from 'supertest';
import express from 'express';
import mongoose from 'mongoose';
import { createAuthorizedUser } from '../utils.js';
import Task from '../../models/task.js';
import taskRoutes from '../../routes/tasks.js';
import { verifyToken } from '../../middleware/auth.js';

// Create a test Express app
const app = express();
app.use(express.json());
app.use(verifyToken);
app.use('/tasks', taskRoutes);

describe('Task API Routes', () => {
  let testUser, authToken;

  beforeEach(async () => {
    // Create a test user with authentication token
    const auth = await createAuthorizedUser();
    testUser = auth.user;
    authToken = auth.token;
  });

  describe('GET /tasks/:userId/:day', () => {
    it('should return tasks for a specific user and day', async () => {
      // Create test tasks
      const today = new Date().toISOString().split('T')[0];
      
      await Task.create([
        {
          user: testUser._id,
          title: 'Test Task 1',
          dueDate: new Date(today),
          complete: false
        },
        {
          user: testUser._id,
          title: 'Test Task 2',
          dueDate: new Date(today),
          complete: true
        }
      ]);

      // Request tasks
      const res = await request(app)
        .get(`/tasks/${testUser._id}/${today}`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert response
      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBe(2);
      expect(res.body[0].title).toBe('Test Task 1');
      expect(res.body[1].title).toBe('Test Task 2');
    });

    it('should return 401 if unauthorized', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const res = await request(app)
        .get(`/tasks/${testUser._id}/${today}`);

      expect(res.status).toBe(401);
    });
  });

  describe('PATCH /tasks/:id/complete', () => {
    it('should toggle the complete status of a task', async () => {
      // Create a test task
      const task = await Task.create({
        user: testUser._id,
        title: 'Toggle Test Task',
        dueDate: new Date(),
        complete: false
      });

      // Toggle the task
      const res = await request(app)
        .patch(`/tasks/${task._id}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert response
      expect(res.status).toBe(200);
      expect(res.body.complete).toBe(true);

      // Toggle it again
      const res2 = await request(app)
        .patch(`/tasks/${task._id}/complete`)
        .set('Authorization', `Bearer ${authToken}`);

      // Assert it toggled back
      expect(res2.status).toBe(200);
      expect(res2.body.complete).toBe(false);
    });
  });
}); 