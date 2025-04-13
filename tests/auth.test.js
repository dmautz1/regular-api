import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import bcrypt from 'bcrypt';
import express from 'express';
import bodyParser from 'body-parser';
import authRoutes from '../routes/auth.js';
import User from '../models/user.js';
import ResetToken from '../models/resetToken.js';

let mongoServer;
let app;

// Setup express app for testing
const setupApp = () => {
  const app = express();
  app.use(bodyParser.json());
  app.use('/auth', authRoutes);
  return app;
};

beforeAll(async () => {
  // Start in-memory MongoDB server
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  
  // Connect to in-memory database
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  
  // Setup app with routes
  app = setupApp();
});

afterAll(async () => {
  await mongoose.connection.close();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Clear database before each test
  await User.deleteMany({});
  await ResetToken.deleteMany({});
});

describe('Authentication Endpoints', () => {
  describe('POST /auth/register', () => {
    it('should register a new user', async () => {
      const res = await request(app)
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      
      expect(res.statusCode).toEqual(201);
      
      // Check that user exists in database
      const user = await User.findOne({ email: 'test@example.com' });
      expect(user).toBeTruthy();
      
      // Password should be hashed
      expect(user.password).not.toEqual('password123');
    });
  });
  
  describe('POST /auth/login', () => {
    beforeEach(async () => {
      // Create a test user
      const passwordHash = await bcrypt.hash('password123', 10);
      await User.create({
        email: 'test@example.com',
        password: passwordHash
      });
    });
    
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123'
        });
      
      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('token');
    });
    
    it('should reject with invalid credentials', async () => {
      const res = await request(app)
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword'
        });
      
      expect(res.statusCode).toEqual(400);
    });
  });
  
  describe('POST /auth/request-password-reset', () => {
    beforeEach(async () => {
      // Create a test user
      await User.create({
        email: 'test@example.com',
        password: await bcrypt.hash('password123', 10)
      });
    });
    
    it('should create a reset token for valid email', async () => {
      // Mock nodemailer
      jest.spyOn(authRoutes, 'transporter', 'get').mockImplementation(() => ({
        sendMail: jest.fn().mockResolvedValue(true)
      }));
      
      const res = await request(app)
        .post('/auth/request-password-reset')
        .send({
          email: 'test@example.com'
        });
      
      expect(res.statusCode).toEqual(200);
      
      // Check that token exists in database
      const user = await User.findOne({ email: 'test@example.com' });
      const resetToken = await ResetToken.findOne({ userId: user._id });
      expect(resetToken).toBeTruthy();
    });
    
    it('should return 404 for invalid email', async () => {
      const res = await request(app)
        .post('/auth/request-password-reset')
        .send({
          email: 'nonexistent@example.com'
        });
      
      expect(res.statusCode).toEqual(404);
    });
  });
  
  describe('POST /auth/reset-password', () => {
    let user;
    let resetToken;
    
    beforeEach(async () => {
      // Create a test user
      user = await User.create({
        email: 'test@example.com',
        password: await bcrypt.hash('oldpassword', 10)
      });
      
      // Create a reset token
      resetToken = await ResetToken.create({
        userId: user._id,
        token: 'valid-token'
      });
    });
    
    it('should reset password with valid token', async () => {
      const res = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'valid-token',
          password: 'newpassword123'
        });
      
      expect(res.statusCode).toEqual(200);
      
      // Check that token is deleted
      const tokenExists = await ResetToken.findById(resetToken._id);
      expect(tokenExists).toBeNull();
      
      // Check that password is updated
      const updatedUser = await User.findById(user._id);
      const isPasswordUpdated = await bcrypt.compare('newpassword123', updatedUser.password);
      expect(isPasswordUpdated).toBe(true);
    });
    
    it('should return 400 for invalid token', async () => {
      const res = await request(app)
        .post('/auth/reset-password')
        .send({
          token: 'invalid-token',
          password: 'newpassword123'
        });
      
      expect(res.statusCode).toEqual(400);
      
      // Password should not be updated
      const updatedUser = await User.findById(user._id);
      const isOldPasswordValid = await bcrypt.compare('oldpassword', updatedUser.password);
      expect(isOldPasswordValid).toBe(true);
    });
  });
}); 