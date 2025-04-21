/**
 * Format success response
 * @param {string} message - Success message
 * @param {Object} data - Response data
 * @returns {Object} - Formatted response
 */
export const formatSuccessResponse = (message, data = null) => {
  const response = {
    success: true,
    message
  };
  
  if (data !== null) {
    response.data = data;
  }
  
  return response;
};

/**
 * Format error response
 * @param {string} message - Error message
 * @param {Object} error - Error details
 * @returns {Object} - Formatted error response
 */
export const formatErrorResponse = (message, error = null) => {
  const response = {
    success: false,
    message
  };
  
  if (error !== null && process.env.NODE_ENV !== 'production') {
    response.error = error;
  }
  
  return response;
};

export default {
  formatSuccessResponse,
  formatErrorResponse
}; 