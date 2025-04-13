import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/user.js';

/**
 * Creates a test user in the database
 * @param {Object} customUserData - Optional user data to override defaults
 * @returns {Object} The created user document
 */
export const createTestUser = async (customUserData = {}) => {
  const passwordHash = await bcrypt.hash('password123', 10);
  
  const defaultUserData = {
    firstName: 'Test',
    lastName: 'User',
    email: `test-${Date.now()}@example.com`,
    password: passwordHash,
  };
  
  const userData = { ...defaultUserData, ...customUserData };
  const user = new User(userData);
  await user.save();
  
  return user;
};

/**
 * Generates a JWT token for a user
 * @param {Object} user - User document
 * @returns {string} JWT token
 */
export const generateAuthToken = (user) => {
  return jwt.sign(
    { id: user._id, email: user.email },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );
};

/**
 * Creates a test user and returns it with an auth token
 * @param {Object} customUserData - Optional user data to override defaults
 * @returns {Object} User document and auth token
 */
export const createAuthorizedUser = async (customUserData = {}) => {
  const user = await createTestUser(customUserData);
  const token = generateAuthToken(user);
  
  return {
    user,
    token
  };
}; 