/**
 * Categories routes module
 * 
 * Handles all category-related API endpoints including:
 * - GET /api/categories - Retrieve all categories
 * 
 * Features:
 * - Redis caching for improved performance
 * - Comprehensive error handling
 * - Detailed request/response logging
 * 
 * @author Hackathon Team
 * @version 1.0.0
 */

/**
 * Utility function to execute database queries with proper error handling
 * @param {Object} fastify - Fastify instance
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters
 * @param {string} operation - Description of the operation for logging
 * @returns {Promise<Object>} Query result
 */
async function executeQuery(fastify, query, params, operation) {
  return new Promise((resolve, reject) => {
    fastify.pg.query(query, params, (err, result) => {
      if (err) {
        fastify.log.error(`Database error during ${operation}:`, {
          error: err.message,
          code: err.code,
          detail: err.detail,
          hint: err.hint,
          query: query,
          params: params
        });
        reject(new Error(`Database operation failed: ${err.message}`));
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * Main categories routes function
 * @param {Object} fastify - Fastify instance
 * @param {Object} opts - Route options
 */
export default async function categoryRoutes(fastify, opts) {

  /**
   * GET /api/categories
   * Retrieve all categories from the categories table
   * 
   * Response:
   * - categories: Array of category objects
   * - total: Total number of categories
   */
  fastify.get('/', {
    schema: {
      response: {
        200: {
          type: 'object',
          properties: {
            categories: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  created_at: { type: 'string', format: 'date-time' }
                }
              }
            },
            total: { type: 'integer' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now();
    
    try {
      fastify.log.info('Fetching all categories', {
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });

      // Generate cache key
      const cacheKey = 'categories:all';
      
      // Try to get data from Redis cache first
      try {
        const cachedData = await fastify.redis.get(cacheKey);
        if (cachedData) {
          fastify.log.info('Cache hit for categories', { cacheKey });
          const result = JSON.parse(cachedData);
          
          reply.header('X-Cache', 'HIT');
          reply.header('X-Response-Time', `${Date.now() - startTime}ms`);
          
          return result;
        }
      } catch (cacheError) {
        fastify.log.warn('Redis cache error, proceeding with database query', {
          error: cacheError.message,
          cacheKey
        });
      }

      // Cache miss - fetch from database
      fastify.log.info('Cache miss, fetching categories from database', { cacheKey });
      
      // Get all categories ordered by name
      const result = await executeQuery(
        fastify,
        'SELECT id, name, created_at FROM categories ORDER BY name ASC',
        [],
        'fetching all categories'
      );

      const response = {
        categories: result.rows,
        total: result.rows.length
      };

      // Cache the result in Redis for 5 minutes (longer TTL for categories as they don't change often)
      try {
        await fastify.redis.set(cacheKey, JSON.stringify(response), 'EX', 300);
        fastify.log.info('Cached categories data', { cacheKey, ttl: 300 });
      } catch (cacheError) {
        fastify.log.warn('Failed to cache categories data', {
          error: cacheError.message,
          cacheKey
        });
      }

      reply.header('X-Cache', 'MISS');
      reply.header('X-Response-Time', `${Date.now() - startTime}ms`);
      
      fastify.log.info('Categories fetched successfully', {
        count: result.rows.length,
        responseTime: `${Date.now() - startTime}ms`
      });

      return response;

    } catch (error) {
      fastify.log.error('Error fetching categories:', {
        error: error.message,
        stack: error.stack,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });

      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch categories',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

} 