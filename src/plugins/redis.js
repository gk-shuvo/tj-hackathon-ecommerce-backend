/**
 * Redis plugin for Fastify
 * 
 * Provides Redis caching functionality with:
 * - Connection management and error handling
 * - Graceful shutdown handling
 * - Connection health monitoring
 * - Comprehensive logging
 * 
 * @author Hackathon Team
 * @version 1.0.0
 */

import fp from 'fastify-plugin';
import Redis from 'ioredis';

/**
 * Redis plugin function
 * Sets up Redis connection and decorates fastify instance with redis client
 * 
 * @param {Object} fastify - Fastify instance
 * @param {Object} options - Plugin options
 */
async function redisPlugin(fastify, options) {
  let redis;
  
  try {
    // Create Redis client with connection options
    redis = new Redis(fastify.config.REDIS_URL, {
      // Connection retry strategy
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      
      // Connection timeout settings
      connectTimeout: 10000,
      commandTimeout: 5000,
      
      // Enable auto-reconnection
      lazyConnect: true,
      
      // Log Redis events for debugging
      showFriendlyErrorStack: process.env.NODE_ENV === 'development'
    });

    // Handle Redis connection events
    redis.on('connect', () => {
      fastify.log.info('Redis client connected successfully');
    });

    redis.on('ready', () => {
      fastify.log.info('Redis client is ready to accept commands');
    });

    redis.on('error', (error) => {
      fastify.log.error('Redis client error:', {
        error: error.message,
        code: error.code,
        syscall: error.syscall,
        address: error.address,
        port: error.port
      });
    });

    redis.on('close', () => {
      fastify.log.warn('Redis client connection closed');
    });

    redis.on('reconnecting', (delay) => {
      fastify.log.info('Redis client reconnecting', { delay });
    });

    redis.on('end', () => {
      fastify.log.info('Redis client connection ended');
    });

    // Test the connection
    try {
      await redis.ping();
      fastify.log.info('Redis connection test successful');
    } catch (pingError) {
      fastify.log.error('Redis connection test failed:', {
        error: pingError.message,
        stack: pingError.stack
      });
      throw new Error(`Redis connection failed: ${pingError.message}`);
    }

    // Decorate fastify instance with redis client
    fastify.decorate('redis', redis);

    // Add graceful shutdown hook
    fastify.addHook('onClose', async (app, done) => {
      try {
        fastify.log.info('Closing Redis connection...');
        
        if (redis && redis.status !== 'end') {
          await redis.quit();
          fastify.log.info('Redis connection closed successfully');
        }
        
        done();
      } catch (error) {
        fastify.log.error('Error closing Redis connection:', {
          error: error.message,
          stack: error.stack
        });
        done(error);
      }
    });

    // Add health check method
    fastify.decorate('redisHealthCheck', async () => {
      try {
        const result = await redis.ping();
        return result === 'PONG';
      } catch (error) {
        fastify.log.error('Redis health check failed:', {
          error: error.message
        });
        return false;
      }
    });

    fastify.log.info('Redis plugin registered successfully');

  } catch (error) {
    fastify.log.error('Failed to initialize Redis plugin:', {
      error: error.message,
      stack: error.stack,
      redisUrl: fastify.config.REDIS_URL ? 'configured' : 'not configured'
    });
    
    // Re-throw the error to prevent the server from starting with a broken Redis connection
    throw error;
  }
}

export default fp(redisPlugin, {
  name: 'redis-plugin',
  dependencies: ['@fastify/env']
});
