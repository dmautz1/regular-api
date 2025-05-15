import axios from 'axios';

/**
 * Middleware to verify Google reCAPTCHA v3 token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const verifyRecaptcha = async (req, res, next) => {
  try {
    // Skip reCAPTCHA verification if in test environment
    if (process.env.NODE_ENV === 'test') {
      return next();
    }

    const { recaptchaToken } = req.body;

    // Check if token exists
    if (!recaptchaToken) {
      return res.status(400).json({
        status: 400,
        message: 'reCAPTCHA verification failed. Please try again.'
      });
    }

    // Verify with Google
    const recaptchaResponse = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: process.env.RECAPTCHA_SECRET_KEY,
          response: recaptchaToken
        }
      }
    );

    // Check if verification was successful
    if (!recaptchaResponse.data.success) {
      console.log('reCAPTCHA verification failed:', recaptchaResponse.data);
      return res.status(400).json({
        status: 400,
        message: 'reCAPTCHA verification failed. Please try again.'
      });
    }

    // For reCAPTCHA v3, we check the score
    // Score ranges from 0.0 to 1.0, where 1.0 is very likely a good interaction
    // and 0.0 is very likely a bot
    const score = recaptchaResponse.data.score;
    const action = recaptchaResponse.data.action;

    // Log the score and action for monitoring
    console.log(`reCAPTCHA score: ${score}, action: ${action}`);

    // Different thresholds for different actions
    const thresholds = {
      login: 0.5,
      register: 0.6,
      forgot_password: 0.5
    };

    const threshold = thresholds[action] || 0.5;

    if (score < threshold) {
      console.log(`reCAPTCHA score too low for action ${action}: ${score}`);
      return res.status(400).json({
        status: 400,
        message: 'Suspicious activity detected. Please try again later.'
      });
    }

    // Verification successful, proceed
    next();
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    res.status(500).json({
      status: 500,
      message: 'Error verifying reCAPTCHA. Please try again later.'
    });
  }
}; 