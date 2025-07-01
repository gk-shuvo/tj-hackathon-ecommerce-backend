/**
 * Error handling utilities
 * 
 * Provides centralized error handling, logging, and response formatting
 * for consistent error management across the application.
 * 
 * @author Hackathon Team
 * @version 1.0.0
 */

/**
 * Custom error classes for different types of errors
 */
export class ValidationError extends Error {
  constructor(message, details = null) {
    super(message);
    this.name = 'ValidationError';
    this.statusCode = 400;
    this.details = details;
  }
}

export class DatabaseError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'DatabaseError';
    this.statusCode = 500;
    this.originalError = originalError;
  }
}

export class CacheError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'CacheError';
    this.statusCode = 500;
    this.originalError = originalError;
  }
}

export class NotFoundError extends Error {
  constructor(resource, identifier) {
    super(`${resource} with identifier '${identifier}' not found`);
    this.name = 'NotFoundError';
    this.statusCode = 404;
    this.resource = resource;
    this.identifier = identifier;
  }
}

/**
 * Log error with structured information
 * @param {Object} fastify - Fastify instance
 * @param {Error} error - Error object
 * @param {Object} context - Additional context information
 */
export function logError(fastify, error, context = {}) {
  const logData = {
    error: error.message,
    name: error.name,
    stack: error.stack,
    statusCode: error.statusCode || 500,
    ...context
  };

  // Add original error details if available
  if (error.originalError) {
    logData.originalError = {
      message: error.originalError.message,
      code: error.originalError.code,
      detail: error.originalError.detail
    };
  }

  // Log with appropriate level based on error type
  if (error.statusCode >= 500) {
    fastify.log.error('Server error occurred:', logData);
  } else if (error.statusCode >= 400) {
    fastify.log.warn('Client error occurred:', logData);
  } else {
    fastify.log.info('Application error occurred:', logData);
  }
}

/**
 * Format error response for client
 * @param {Error} error - Error object
 * @param {boolean} isDevelopment - Whether in development mode
 * @returns {Object} Formatted error response
 */
export function formatErrorResponse(error, isDevelopment = false) {
  const response = {
    error: error.name || 'Internal Server Error',
    message: error.message,
    statusCode: error.statusCode || 500
  };

  // Add additional details in development mode
  if (isDevelopment) {
    if (error.stack) {
      response.stack = error.stack;
    }
    if (error.details) {
      response.details = error.details;
    }
    if (error.originalError) {
      response.originalError = {
        message: error.originalError.message,
        code: error.originalError.code
      };
    }
  }

  return response;
}

/**
 * Handle database errors and convert to appropriate application errors
 * @param {Error} dbError - Database error
 * @param {string} operation - Description of the operation that failed
 * @returns {Error} Application error
 */
export function handleDatabaseError(dbError, operation) {
  // Handle specific PostgreSQL error codes
  switch (dbError.code) {
    case '23505': // unique_violation
      return new ValidationError('Duplicate entry found', {
        constraint: dbError.constraint,
        detail: dbError.detail
      });
    
    case '23503': // foreign_key_violation
      return new ValidationError('Referenced record does not exist', {
        constraint: dbError.constraint,
        detail: dbError.detail
      });
    
    case '23502': // not_null_violation
      return new ValidationError('Required field is missing', {
        column: dbError.column,
        detail: dbError.detail
      });
    
    case '42P01': // undefined_table
      return new DatabaseError('Database table not found', dbError);
    
    case '42P02': // undefined_column
      return new DatabaseError('Database column not found', dbError);
    
    case '08000': // connection_exception
    case '08003': // connection_does_not_exist
    case '08006': // connection_failure
      return new DatabaseError('Database connection failed', dbError);
    
    default:
      return new DatabaseError(`Database operation failed: ${operation}`, dbError);
  }
}

/**
 * Validate and sanitize input parameters
 * @param {Object} params - Parameters to validate
 * @param {Object} schema - Validation schema
 * @returns {Object} Sanitized parameters
 */
export function validateParams(params, schema) {
  const errors = [];
  const sanitized = {};

  for (const [key, rules] of Object.entries(schema)) {
    const value = params[key];
    
    // Check if required field is present
    if (rules.required && (value === undefined || value === null || value === '')) {
      errors.push(`${key} is required`);
      continue;
    }

    // Skip validation if value is not provided and not required
    if (value === undefined || value === null) {
      continue;
    }

    // Type validation
    if (rules.type === 'integer') {
      const num = parseInt(value);
      if (isNaN(num)) {
        errors.push(`${key} must be a valid integer`);
        continue;
      }
      sanitized[key] = num;
    } else if (rules.type === 'number') {
      const num = parseFloat(value);
      if (isNaN(num)) {
        errors.push(`${key} must be a valid number`);
        continue;
      }
      sanitized[key] = num;
    } else {
      sanitized[key] = value;
    }

    // Range validation
    if (rules.min !== undefined && sanitized[key] < rules.min) {
      errors.push(`${key} must be at least ${rules.min}`);
    }
    if (rules.max !== undefined && sanitized[key] > rules.max) {
      errors.push(`${key} cannot exceed ${rules.max}`);
    }

    // Pattern validation
    if (rules.pattern && !rules.pattern.test(String(sanitized[key]))) {
      errors.push(`${key} format is invalid`);
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Validation failed', errors);
  }

  return sanitized;
}

/**
 * Async wrapper for error handling
 * @param {Function} fn - Async function to wrap
 * @returns {Function} Wrapped function with error handling
 */
export function asyncHandler(fn) {
  return async (request, reply) => {
    try {
      return await fn(request, reply);
    } catch (error) {
      // Log the error
      logError(request.server, error, {
        url: request.url,
        method: request.method,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });

      // Format and send error response
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = formatErrorResponse(error, isDevelopment);
      
      reply.code(errorResponse.statusCode).send(errorResponse);
    }
  };
} 