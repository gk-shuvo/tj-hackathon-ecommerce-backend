/**
 * Health check routes module
 * 
 * Provides endpoints for monitoring application health, including:
 * - GET /health - Basic health check
 * - GET /health/detailed - Detailed health check with dependencies
 * 
 * @author Hackathon Team
 * @version 1.0.0
 */

/**
 * Main health check routes function
 * @param {Object} fastify - Fastify instance
 * @param {Object} opts - Route options
 */
export default async function healthRoutes(fastify, opts) {
  
  /**
   * GET /health
   * Basic health check endpoint
   * 
   * Response:
   * - status: "ok" or "error"
   * - timestamp: Current timestamp
   * - uptime: Application uptime in seconds
   */
  fastify.get('/', async (request, reply) => {
    const startTime = Date.now();
    
    try {
      const healthStatus = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development'
      };

      reply.header('X-Response-Time', `${Date.now() - startTime}ms`);
      
      fastify.log.debug('Health check completed', {
        status: healthStatus.status,
        responseTime: `${Date.now() - startTime}ms`
      });

      return healthStatus;

    } catch (error) {
      fastify.log.error('Health check failed:', {
        error: error.message,
        stack: error.stack
      });

      reply.code(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * GET /health/detailed
   * Detailed health check with dependency status
   * 
   * Response:
   * - status: Overall status
   * - timestamp: Current timestamp
   * - uptime: Application uptime
   * - dependencies: Status of each dependency
   */
  fastify.get('/detailed', async (request, reply) => {
    const startTime = Date.now();
    
    try {
      const healthChecks = {
        application: { status: 'ok', responseTime: null },
        database: { status: 'unknown', responseTime: null, error: null },
        redis: { status: 'unknown', responseTime: null, error: null }
      };

      // Check database connectivity
      try {
        const dbStartTime = Date.now();
        await new Promise((resolve, reject) => {
          fastify.pg.query('SELECT 1 as health_check', (err, result) => {
            if (err) {
              reject(err);
            } else {
              resolve(result);
            }
          });
        });
        healthChecks.database.status = 'ok';
        healthChecks.database.responseTime = Date.now() - dbStartTime;
      } catch (dbError) {
        healthChecks.database.status = 'error';
        healthChecks.database.error = dbError.message;
        fastify.log.warn('Database health check failed:', {
          error: dbError.message
        });
      }

      // Check Redis connectivity
      try {
        const redisStartTime = Date.now();
        const redisHealth = await fastify.redisHealthCheck();
        healthChecks.redis.status = redisHealth ? 'ok' : 'error';
        healthChecks.redis.responseTime = Date.now() - redisStartTime;
        
        if (!redisHealth) {
          healthChecks.redis.error = 'Redis health check failed';
        }
      } catch (redisError) {
        healthChecks.redis.status = 'error';
        healthChecks.redis.error = redisError.message;
        fastify.log.warn('Redis health check failed:', {
          error: redisError.message
        });
      }

      // Determine overall status
      const overallStatus = Object.values(healthChecks).every(check => check.status === 'ok') 
        ? 'ok' 
        : 'degraded';

      const detailedHealth = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        dependencies: healthChecks
      };

      reply.header('X-Response-Time', `${Date.now() - startTime}ms`);
      
      fastify.log.info('Detailed health check completed', {
        status: overallStatus,
        dependencies: Object.keys(healthChecks).map(key => ({
          name: key,
          status: healthChecks[key].status
        })),
        responseTime: `${Date.now() - startTime}ms`
      });

      return detailedHealth;

    } catch (error) {
      fastify.log.error('Detailed health check failed:', {
        error: error.message,
        stack: error.stack
      });

      reply.code(503).send({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  /**
   * GET /health/ready
   * Readiness check for Kubernetes/container orchestration
   * 
   * Returns 200 only if all critical dependencies are healthy
   */
  fastify.get('/ready', async (request, reply) => {
    try {
      // Check database
      await new Promise((resolve, reject) => {
        fastify.pg.query('SELECT 1 as health_check', (err, result) => {
          if (err) {
            reject(err);
          } else {
            resolve(result);
          }
        });
      });

      // Check Redis
      const redisHealth = await fastify.redisHealthCheck();
      if (!redisHealth) {
        throw new Error('Redis is not ready');
      }

      reply.send({
        status: 'ready',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      fastify.log.warn('Readiness check failed:', {
        error: error.message
      });

      reply.code(503).send({
        status: 'not ready',
        timestamp: new Date().toISOString(),
        error: error.message
      });
    }
  });
} 