import Joi from 'joi';

// Middleware factory that takes a Joi schema and returns a middleware function
export const validateRequest = (schema) => {
  return (req, res, next) => {
    // Determine which part of the request to validate
    const validationTargets = {
      body: req.body,
      query: req.query,
      params: req.params
    };

    // Validate each part of the request that has a corresponding schema
    for (const key in schema) {
      if (schema[key]) {
        const { error } = schema[key].validate(validationTargets[key], { abortEarly: false });
        
        if (error) {
          const errorMessage = error.details.map(detail => detail.message).join(', ');
          return res.status(400).json({ status: 400, message: errorMessage });
        }
      }
    }

    next();
  };
};

// Schema for user registration
export const registerSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'any.required': 'Password is required'
    }),
    passwordConfirmation: Joi.string().valid(Joi.ref('password')).required().messages({
      'any.only': 'Passwords must match',
      'any.required': 'Password confirmation is required'
    }),
    firstName: Joi.string().trim().allow(''),
    lastName: Joi.string().trim().allow(''),
    location: Joi.string().trim().allow(''),
    occupation: Joi.string().trim().allow(''),
    recaptchaToken: Joi.string().required().messages({
      'any.required': 'reCAPTCHA verification is required'
    })
  })
};

// Schema for user login
export const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    password: Joi.string().required().messages({
      'any.required': 'Password is required'
    }),
    recaptchaToken: Joi.string().required().messages({
      'any.required': 'reCAPTCHA verification is required'
    })
  })
};

// Schema for password reset request
export const passwordResetRequestSchema = {
  body: Joi.object({
    email: Joi.string().email().required().messages({
      'string.email': 'Please provide a valid email address',
      'any.required': 'Email is required'
    }),
    recaptchaToken: Joi.string().required().messages({
      'any.required': 'reCAPTCHA verification is required'
    })
  })
};

// Schema for password reset
export const passwordResetSchema = {
  body: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Reset token is required'
    }),
    password: Joi.string().min(8).required().messages({
      'string.min': 'Password must be at least 8 characters long',
      'any.required': 'Password is required'
    })
  })
};

// Schema for creating tasks
export const createTaskSchema = {
  body: Joi.object({
    title: Joi.string().required().messages({
      'any.required': 'Task title is required'
    }),
    description: Joi.string().allow(''),
    dueDate: Joi.string().allow(null),
    completed: Joi.boolean().default(false),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium'),
    category: Joi.string().allow(''),
    tags: Joi.array().items(Joi.string()),
    userId: Joi.string(),
    isRecurring: Joi.boolean().default(false),
    recurringDays: Joi.array().items(Joi.number().min(0).max(6)).allow(null)
  })
};

// Schema for updating tasks
export const updateTaskSchema = {
  params: Joi.object({
    id: Joi.string().guid({ version: 'uuidv4' }).required().messages({
      'string.guid': 'Task ID must be a valid UUID',
      'any.required': 'Task ID is required'
    })
  }),
  body: Joi.object({
    title: Joi.string(),
    description: Joi.string().allow(''),
    dueDate: Joi.string().allow(null),
    completed: Joi.boolean(),
    complete: Joi.boolean(),
    priority: Joi.string().valid('low', 'medium', 'high'),
    category: Joi.string().allow(''),
    tags: Joi.array().items(Joi.string()),
    isDeleted: Joi.boolean()
  })
};

// Schema for creating programs
export const createProgramSchema = {
  body: Joi.object({
    name: Joi.string().required().messages({
      'any.required': 'Program name is required'
    }),
    description: Joi.string().allow(''),
    category: Joi.string().allow(''),
    difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced').default('intermediate'),
    activities: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      description: Joi.string().allow(''),
      duration: Joi.number().min(0),
      sets: Joi.number().integer().min(0),
      reps: Joi.number().integer().min(0),
      weight: Joi.number().min(0),
      distance: Joi.number().min(0),
      calories: Joi.number().min(0)
    })),
    isPublic: Joi.boolean().default(false)
  })
};

// Schema for updating programs
export const updateProgramSchema = {
  params: Joi.object({
    id: Joi.string().required().messages({
      'any.required': 'Program ID is required'
    })
  }),
  body: Joi.object({
    name: Joi.string(),
    description: Joi.string().allow(''),
    category: Joi.string().allow(''),
    difficulty: Joi.string().valid('beginner', 'intermediate', 'advanced'),
    activities: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      description: Joi.string().allow(''),
      duration: Joi.number().min(0),
      sets: Joi.number().integer().min(0),
      reps: Joi.number().integer().min(0),
      weight: Joi.number().min(0),
      distance: Joi.number().min(0),
      calories: Joi.number().min(0)
    })),
    isPublic: Joi.boolean(),
    isDeleted: Joi.boolean()
  })
};

// Schema for profile update
export const updateProfileSchema = {
  body: Joi.object({
    name: Joi.string().trim().allow(''),
    bio: Joi.string().trim().allow(''),
    email: Joi.string().email().messages({
      'string.email': 'Please provide a valid email address',
    })
  })
};

// Schema for updating password
export const updatePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().required().messages({
      'any.required': 'Current password is required'
    }),
    newPassword: Joi.string().min(8).required().messages({
      'string.min': 'New password must be at least 8 characters long',
      'any.required': 'New password is required'
    }),
    confirmNewPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'any.only': 'Passwords must match',
      'any.required': 'Password confirmation is required'
    })
  })
};

// Schema for activities
export const activitySchema = {
  body: Joi.object({
    programId: Joi.string().required().messages({
      'any.required': 'Program ID is required'
    }),
    activities: Joi.array().items(Joi.object({
      id: Joi.string(), // Optional for updates
      title: Joi.string().required().messages({
        'any.required': 'Activity title is required'
      }),
      description: Joi.string().allow(''),
      cron: Joi.string().required().messages({
        'any.required': 'Cron expression is required'
      }),
      position: Joi.number().integer().min(0) // Optional for ordering
    })).required().messages({
      'any.required': 'At least one activity is required'
    })
  })
};

// Schema for reordering activities
export const reorderActivitiesSchema = {
  body: Joi.object({
    programId: Joi.string().required().messages({
      'any.required': 'Program ID is required'
    }),
    activityIds: Joi.array().items(Joi.string()).required().messages({
      'any.required': 'Activity IDs are required for reordering'
    })
  })
}; 