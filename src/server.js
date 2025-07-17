/**
 * Main server file for the Fastify API
 * 
 * This file sets up the Fastify server with all necessary plugins,
 * environment configuration, and route registration.
 * 
 * @author Hackathon Team
 * @version 1.0.0
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import dotenv from 'dotenv';
import fastifyEnv from '@fastify/env';
import postgres from '@fastify/postgres';
import redisPlugin from './plugins/redis.js';
import productRoutes from './routes/products.js';
import healthRoutes from './routes/health.js';
import { 
  requestLogger, 
  responseLogger, 
  securityHeaders, 
  rateLimiter, 
  requestTimer, 
  errorTracker, 
  requestValidator,
  requestQueueManager
} from './utils/middleware.js';

// Load environment variables from .env file
dotenv.config();

/**
 * Environment configuration schema
 * Defines required environment variables and their types
 */
const schema = {
  type: 'object',
  required: ['PORT', 'DB_CONNECTION_STRING', 'REDIS_URL'],
  properties: {
    PORT: { 
      type: 'string',
      description: 'Port number for the server to listen on'
    },
    DB_CONNECTION_STRING: { 
      type: 'string',
      description: 'PostgreSQL connection string'
    },
    REDIS_URL: { 
      type: 'string',
      description: 'Redis connection URL'
    }
  }
};

/**
 * Create Fastify instance with logging enabled
 * Logging will help with debugging and monitoring
 */
const app = Fastify({ 
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  }
});

/**
 * Initialize the server and register all plugins and routes
 */
async function startServer() {
  try {
    // Register environment configuration plugin
    await app.register(fastifyEnv, {
      schema,
      dotenv: true
    });

    // Register CORS plugin for cross-origin requests
    await app.register(cors, {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || true,
      credentials: true
    });

    // Register compression plugin for response optimization
    await app.register(compress, {
      threshold: 1024 // Only compress responses larger than 1KB
    });

    // Register PostgreSQL plugin with connection string
    await app.register(postgres, { 
      connectionString: app.config.DB_CONNECTION_STRING,
      pool: {
        min: parseInt(process.env.DB_POOL_MIN) || 5,
        max: parseInt(process.env.DB_POOL_MAX) || 50, // Increased for load testing
        acquireTimeoutMillis: 30000, // 30 seconds
        createTimeoutMillis: 30000,
        destroyTimeoutMillis: 5000,
        idleTimeoutMillis: 30000,
        reapIntervalMillis: 1000,
        createRetryIntervalMillis: 200
      }
    });

    // Register Redis plugin for caching
    await app.register(redisPlugin);

    // Register product routes with API prefix
    await app.register(productRoutes, { prefix: '/api/products' });

    // Register health check routes
    await app.register(healthRoutes, { prefix: '/health' });

    // Add global error handler
    app.setErrorHandler((error, request, reply) => {
      app.log.error('Global error handler caught:', {
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
        userAgent: request.headers['user-agent']
      });

      // Don't expose internal errors in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      const errorResponse = {
        error: 'Internal Server Error',
        message: isDevelopment ? error.message : 'Something went wrong',
        ...(isDevelopment && { stack: error.stack })
      };

      reply.code(500).send(errorResponse);
    });

    // Add middleware hooks
    app.addHook('onRequest', requestLogger(app));
    app.addHook('onRequest', securityHeaders(app));
    
    // Rate limiting - adjusted for load testing
    // During normal operation: 100 requests per 15 minutes
    // During load testing: 10000 requests per 15 minutes (or disable)
    // const rateLimitMax = process.env.NODE_ENV === 'test' || process.env.LOAD_TESTING === 'true' 
    //   ? 10000 
    //   : 10000;
    
    // app.addHook('onRequest', rateLimiter(app, {
    //   windowMs: 15 * 60 * 1000, // 15 minutes
    //   maxRequests: rateLimitMax
    // }));
    
    app.addHook('onRequest', requestTimer(app));
    app.addHook('onRequest', requestValidator(app));
    app.addHook('onRequest', requestQueueManager(app));
    
    app.addHook('onResponse', responseLogger(app));
    
    app.addHook('onError', errorTracker(app));

    // Wait for the app to be ready
    await app.ready();
    app.log.info('Server is ready to handle requests');

    // Start listening on specified port
    await app.listen({ 
      port: app.config.PORT, 
      host: '0.0.0.0' 
    });

    app.log.info(`Server listening on port ${app.config.PORT}`);

  } catch (error) {
    app.log.error('Failed to start server:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
}

/**
 * Graceful shutdown handler
 * Ensures proper cleanup of resources when the server shuts down
 */
const gracefulShutdown = async (signal) => {
  app.log.info(`Received ${signal}. Starting graceful shutdown...`);
  
  try {
    // Close the server
    await app.close();
    app.log.info('Server closed successfully');
    process.exit(0);
  } catch (error) {
    app.log.error('Error during graceful shutdown:', {
      error: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

// Handle different shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  app.log.error('Uncaught Exception:', {
    error: error.message,
    stack: error.stack
  });
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  app.log.error('Unhandled Rejection at:', {
    promise: promise,
    reason: reason
  });
  process.exit(1);
});

// Start the server
startServer();
