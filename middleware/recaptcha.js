import axios from 'axios';

/**
 * Middleware to verify Google reCAPTCHA token
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

    // If verification score is too low, reject the request
    if (recaptchaResponse.data.score && recaptchaResponse.data.score < 0.5) {
      console.log('reCAPTCHA score too low:', recaptchaResponse.data.score);
      return res.status(400).json({
        status: 400,
        message: 'Bot activity detected. Please try again later.'
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