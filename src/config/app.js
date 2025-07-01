/**
 * Application configuration
 * 
 * Centralized configuration settings for the application.
 * Environment-specific settings are loaded from environment variables.
 * 
 * @author Hackathon Team
 * @version 1.0.0
 */

/**
 * Application configuration object
 */
export const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'info'
  },

  // Database configuration
  database: {
    connectionString: process.env.DB_CONNECTION_STRING,
    pool: {
      min: parseInt(process.env.DB_POOL_MIN) || 2,
      max: parseInt(process.env.DB_POOL_MAX) || 10
    }
  },

  // Redis configuration
  redis: {
    url: process.env.REDIS_URL,
    options: {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      connectTimeout: 10000,
      commandTimeout: 5000,
      lazyConnect: true,
      showFriendlyErrorStack: process.env.NODE_ENV === 'development'
    }
  },

  // CORS configuration
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || true,
    credentials: true
  },

  // Rate limiting configuration
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
    skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true'
  },

  // Cache configuration
  cache: {
    ttl: parseInt(process.env.CACHE_TTL) || 60, // 60 seconds
    prefix: process.env.CACHE_PREFIX || 'api'
  },

  // Pagination configuration
  pagination: {
    defaultLimit: parseInt(process.env.PAGINATION_DEFAULT_LIMIT) || 10,
    maxLimit: parseInt(process.env.PAGINATION_MAX_LIMIT) || 100,
    defaultPage: 1
  },

  // Security configuration
  security: {
    maxRequestSize: parseInt(process.env.MAX_REQUEST_SIZE) || 10 * 1024 * 1024, // 10MB
    slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD) || 1000 // 1 second
  },

  // Health check configuration
  health: {
    enabled: process.env.HEALTH_CHECK_ENABLED !== 'false',
    detailed: process.env.HEALTH_CHECK_DETAILED !== 'false',
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000 // 5 seconds
  }
};

/**
 * Validate required configuration
 * @throws {Error} If required configuration is missing
 */
export function validateConfig() {
  const required = [
    'database.connectionString',
    'redis.url'
  ];

  const missing = required.filter(path => {
    const keys = path.split('.');
    let value = config;
    for (const key of keys) {
      value = value[key];
      if (value === undefined) return true;
    }
    return false;
  });

  if (missing.length > 0) {
    throw new Error(`Missing required configuration: ${missing.join(', ')}`);
  }
}

/**
 * Get configuration value by path
 * @param {string} path - Configuration path (e.g., 'server.port')
 * @param {*} defaultValue - Default value if not found
 * @returns {*} Configuration value
 */
export function getConfig(path, defaultValue = undefined) {
  const keys = path.split('.');
  let value = config;
  
  for (const key of keys) {
    if (value && typeof value === 'object' && key in value) {
      value = value[key];
    } else {
      return defaultValue;
    }
  }
  
  return value;
}

/**
 * Check if application is in development mode
 * @returns {boolean} True if in development mode
 */
export function isDevelopment() {
  return config.server.environment === 'development';
}

/**
 * Check if application is in production mode
 * @returns {boolean} True if in production mode
 */
export function isProduction() {
  return config.server.environment === 'production';
}

/**
 * Check if application is in test mode
 * @returns {boolean} True if in test mode
 */
export function isTest() {
  return config.server.environment === 'test';
} 