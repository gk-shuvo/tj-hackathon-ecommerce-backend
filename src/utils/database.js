/**
 * Database utility functions
 * 
 * Shared database operations for use across route files
 * 
 * @author Hackathon Team
 * @version 1.0.0
 */

/**
 * Execute a database query with error handling and logging
 * @param {Object} fastify - Fastify instance
 * @param {string} query - SQL query string
 * @param {Array} params - Query parameters
 * @param {string} operation - Description of the operation for logging
 * @returns {Promise<Object>} Query result
 */
export async function executeQuery(fastify, query, params, operation) {
  try {
    const startTime = Date.now();
    
    fastify.log.info(`Executing database query: ${operation}`, {
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params: params,
      operation
    });

    const result = await fastify.pg.query(query, params);
    
    const duration = Date.now() - startTime;
    fastify.log.info(`Database query completed: ${operation}`, {
      duration: `${duration}ms`,
      rowCount: result.rowCount,
      operation
    });

    return result;
  } catch (error) {
    fastify.log.error(`Database query failed: ${operation}`, {
      error: error.message,
      stack: error.stack,
      query: query.substring(0, 100) + (query.length > 100 ? '...' : ''),
      params: params,
      operation
    });
    throw error;
  }
} 