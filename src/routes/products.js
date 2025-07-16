/**
 * Product routes module
 * 
 * Handles all product-related API endpoints including:
 * - GET /api/products - Retrieve paginated product list with caching
 * - GET /api/products/:id - Retrieve specific product by ID
 * - GET /api/products/search - Search products using PostgreSQL full-text search
 * 
 * Features:
 * - Redis caching for improved performance
 * - Input validation and sanitization
 * - Comprehensive error handling
 * - Detailed request/response logging
 * 
 * @author Hackathon Team
 * @version 1.0.0
 */

/**
 * Input validation schemas for request parameters
 */
const querySchema = {
  type: 'object',
  properties: {
    page: { 
      type: 'string', 
      pattern: '^[1-9]\\d*$',
      description: 'Page number (must be positive integer)'
    },
    limit: { 
      type: 'string', 
      pattern: '^[1-9]\\d*$',
      description: 'Items per page (must be positive integer, max 100)'
    },
    search: {
      type: 'string',
      minLength: 1,
      maxLength: 100,
      description: 'Search term for product name and description'
    }
  }
};

const paramsSchema = {
  type: 'object',
  properties: {
    id: { 
      type: 'string', 
      pattern: '^[1-9]\\d*$',
      description: 'Product ID (must be positive integer)'
    }
  },
  required: ['id']
};

/**
 * Utility function to validate and sanitize pagination parameters
 * @param {Object} query - Request query parameters
 * @returns {Object} Sanitized pagination parameters
 */
function validatePaginationParams(query) {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 10;
  
  // Validate page number
  if (page < 1) {
    throw new Error('Page number must be greater than 0');
  }
  
  // Validate and limit the maximum items per page
  if (limit < 1) {
    throw new Error('Limit must be greater than 0');
  }
  if (limit > 100) {
    throw new Error('Limit cannot exceed 100 items per page');
  }
  
  return { page, limit };
}

/**
 * Utility function to validate and sanitize search parameters
 * @param {Object} query - Request query parameters
 * @returns {Object} Sanitized search parameters
 */
function validateSearchParams(query) {

  console.log("Inside validateSearchParams >> ", query.search);
  const { page, limit } = validatePaginationParams(query);
  const search = query.search ? query.search.trim() : null;
  
  // Validate search term
  if (search !== null && search.length < 1) {
    throw new Error('Search term cannot be empty');
  }
  
  if (search !== null && search.length > 100) {
    throw new Error('Search term cannot exceed 100 characters');
  }
  
  return { page, limit, search };
}

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
 * Main product routes function
 * @param {Object} fastify - Fastify instance
 * @param {Object} opts - Route options
 */
export default async function productRoutes(fastify, opts) {



    /**
   * GET /api/products/search
   * Search products using PostgreSQL full-text search
   * 
   * Query Parameters:
   * - search: Search term for product name and description
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 10, max: 100)
   * 
   * Response:
   * - products: Array of product objects matching search criteria
   * - page: Current page number
   * - limit: Items per page
   * - total: Total number of matching products
   * - searchTerm: The search term used
   */
    fastify.get('/search', {
      schema: {
        querystring: querySchema,
        response: {
          200: {
            type: 'object',
            properties: {
              products: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                    description: { type: 'string' },
                    price: { type: 'number' },
                    image_url: { type: 'string' },
                    stock: {type : 'integer'},
                    rank: { type: 'number' }
                  }
                }
              },
              page: { type: 'integer' },
              limit: { type: 'integer' },
              total: { type: 'integer' },
              searchTerm: { type: 'string' }
            }
          }
        }
      }
    }, async (request, reply) => {

      console.log("Inside search >> ", request.query);

      const startTime = Date.now();
      
      try {
        // Validate and sanitize input parameters
        const { page, limit, search } = validateSearchParams(request.query);
        const offset = (page - 1) * limit;
        
        // Require search term for this endpoint
        if (!search) {
          fastify.log.warn('Search term required but not provided', {
            userAgent: request.headers['user-agent'],
            ip: request.ip
          });
          
          reply.code(400).send({
            error: 'Bad Request',
            message: 'Search term is required',
            details: 'Please provide a search term using the "search" query parameter'
          });
          return;
        }
        
        fastify.log.info('Searching products', {
          searchTerm: search,
          page,
          limit,
          offset,
          userAgent: request.headers['user-agent'],
          ip: request.ip
        });
  
        // Generate cache key for this specific search query
        const cacheKey = `products:search:${encodeURIComponent(search)}:page:${page}:limit:${limit}`;
        
        // Try to get data from Redis cache first
        try {
          const cachedData = await fastify.redis.get(cacheKey);
          if (cachedData) {
            fastify.log.info('Cache hit for product search', { cacheKey, searchTerm: search, page, limit });
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
  
        // Cache miss - perform full-text search in database
        fastify.log.info('Cache miss, performing database search', { cacheKey, searchTerm: search, page, limit });
        
        // Use PostgreSQL full-text search with pre-computed search vector for optimal performance
        const searchQuery = `
          SELECT 
            id, 
            name, 
            description, 
            price, 
            image_url,
            ts_rank(search_vector, plainto_tsquery('english', $1)) as rank
          FROM products 
          WHERE search_vector @@ plainto_tsquery('english', $1)
          ORDER BY rank DESC, name ASC
          LIMIT $2 OFFSET $3
        `;
        
        const countQuery = `
          SELECT COUNT(*) as total
          FROM products 
          WHERE search_vector @@ plainto_tsquery('english', $1)
        `;
  
        // Execute search query
        const result = await executeQuery(
          fastify,
          searchQuery,
          [search, limit, offset],
          'searching products'
        );
  
        // Get total count for pagination
        const countResult = await executeQuery(
          fastify,
          countQuery,
          [search],
          'counting search results'
        );
  
        const total = parseInt(countResult.rows[0].total);
        
        const response = {
          products: result.rows,
          page,
          limit,
          total,
          searchTerm: search
        };
  
        // Cache the result in Redis for 60 seconds
        try {
          await fastify.redis.set(cacheKey, JSON.stringify(response), 'EX', 60);
          fastify.log.info('Cached search results', { cacheKey, ttl: 60, searchTerm: search });
        } catch (cacheError) {
          fastify.log.warn('Failed to cache search results', {
            error: cacheError.message,
            cacheKey
          });
        }
  
        reply.header('X-Cache', 'MISS');
        reply.header('X-Response-Time', `${Date.now() - startTime}ms`);
        
        fastify.log.info('Product search completed successfully', {
          searchTerm: search,
          count: result.rows.length,
          total,
          page,
          limit,
          responseTime: `${Date.now() - startTime}ms`
        });
  
        return response;
  
      } catch (error) {
        fastify.log.error('Error searching products:', {
          error: error.message,
          stack: error.stack,
          query: request.query,
          userAgent: request.headers['user-agent'],
          ip: request.ip
        });
  
        // Determine appropriate error response
        if (error.message.includes('Page number must be') || 
            error.message.includes('Limit must be') ||
            error.message.includes('Limit cannot exceed') ||
            error.message.includes('Search term cannot be')) {
          reply.code(400).send({
            error: 'Bad Request',
            message: error.message,
            details: 'Invalid search parameters'
          });
        } else {
          reply.code(500).send({
            error: 'Internal Server Error',
            message: 'Failed to search products',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      }
    });
  

    fastify.get('/debug/no-params', {
      schema: {
        params: {},
        querystring: {},
        response: {
          200: { type: 'object', properties: { params: { type: 'object' }} }
        }
      }
    }, async (request, reply) => {
      fastify.log.info('🧪 DEBUG no-params called with', request.params);
      return { params: request.params };
    });
    
  
  /**
   * GET /api/products
   * Retrieve paginated list of products with Redis caching
   * 
   * Query Parameters:
   * - page: Page number (default: 1)
   * - limit: Items per page (default: 10, max: 100)
   * 
   * Response:
   * - products: Array of product objects
   * - page: Current page number
   * - limit: Items per page
   * - total: Total number of products (if available)
   */
  fastify.get('/', {
    schema: {
      querystring: querySchema,
      response: {
        200: {
          type: 'object',
          properties: {
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  image_url: { type: 'string' },
                  stock: {type : 'integer'}
                }
              }
            },
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: {type: 'integer'}
          }
        }
      }
    }
  }, async (request, reply) => {

    console.log("Inside products >> ", request.query);
    const startTime = Date.now();
    
    try {
      // Validate and sanitize input parameters
      const { page, limit } = validatePaginationParams(request.query);
      const offset = (page - 1) * limit;
      
      fastify.log.info('Fetching products', {
        page,
        limit,
        offset,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });

      // Generate cache keys
      const cacheKey = `products:page:${page}:limit:${limit}`;
      const totalCountKey = 'products:total:count';
      
      // Try to get data from Redis cache first
      try {
        const cachedData = await fastify.redis.get(cacheKey);
        if (cachedData) {
          fastify.log.info('Cache hit for products', { cacheKey, page, limit });
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
      fastify.log.info('Cache miss, fetching from database', { cacheKey, page, limit });
      
      // Try to get total count from cache first
      let total;
      try {
        const cachedTotal = await fastify.redis.get(totalCountKey);
        if (cachedTotal) {
          total = parseInt(cachedTotal);
          fastify.log.info('Cache hit for total count', { totalCountKey, total });
        }
      } catch (cacheError) {
        fastify.log.warn('Redis cache error for total count, proceeding with database query', {
          error: cacheError.message,
          totalCountKey
        });
      }

      // Execute queries (products query always, count query only if not cached)
      const queries = [
        executeQuery(
          fastify,
          'SELECT * FROM products ORDER BY id LIMIT $1 OFFSET $2',
          [limit, offset],
          'fetching products'
        )
      ];

      if (!total) {
        queries.push(
          executeQuery(
            fastify,
            'SELECT COUNT(*) as total FROM products',
            [],
            'counting total products'
          )
        );
      }

      const results = await Promise.all(queries);
      const result = results[0];
      
      if (!total) {
        total = parseInt(results[1].rows[0].total);
        // Cache total count for 5 minutes (longer than product cache)
        try {
          await fastify.redis.set(totalCountKey, total.toString(), 'EX', 300);
          fastify.log.info('Cached total count', { totalCountKey, total, ttl: 300 });
        } catch (cacheError) {
          fastify.log.warn('Failed to cache total count', {
            error: cacheError.message,
            totalCountKey
          });
        }
      }

      const response = {
        products: result.rows,
        page,
        limit,
        total
      };

      // Cache the result in Redis for 60 seconds
      try {
        await fastify.redis.set(cacheKey, JSON.stringify(response), 'EX', 60);
        fastify.log.info('Cached products data', { cacheKey, ttl: 60 });
      } catch (cacheError) {
        fastify.log.warn('Failed to cache products data', {
          error: cacheError.message,
          cacheKey
        });
      }

      reply.header('X-Cache', 'MISS');
      reply.header('X-Response-Time', `${Date.now() - startTime}ms`);
      
      fastify.log.info('Products fetched successfully', {
        count: result.rows.length,
        page,
        limit,
        responseTime: `${Date.now() - startTime}ms`
      });

      return response;

    } catch (error) {
      fastify.log.error('Error fetching products:', {
        error: error.message,
        stack: error.stack,
        query: request.query,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });

      // Determine appropriate error response
      if (error.message.includes('Page number must be') || 
          error.message.includes('Limit must be') ||
          error.message.includes('Limit cannot exceed')) {
        reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
          details: 'Invalid pagination parameters'
        });
      } else {
        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch products',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  });


  /**
   * GET /api/products/:id
   * Retrieve a specific product by ID
   * 
   * Parameters:
   * - id: Product ID (positive integer)
   * 
   * Response:
   * - Product object or 404 if not found
   */
  fastify.get('/:id', {
    schema: {
      params: paramsSchema,
      response: {
        200: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            name: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'number' },
            image_url: { type: 'string' },
            stock: { type: 'integer' },
            brand: { type: 'string' },
            category: { type: 'string' },
            currency: { type: 'string' },
            ean: { type: 'string' },
            color: { type: 'string' },
            size: { type: 'string' },
            availability: { type: 'string' },
            short_description: { type: 'string' },
            internal_id: { type: 'string' }
          }
        },
        404: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now();
    
    try {
      const { id } = request.params;
      
      // Validate ID parameter
      const productId = parseInt(id);
      if (isNaN(productId) || productId < 1) {
        fastify.log.warn('Invalid product ID provided', {
          id,
          userAgent: request.headers['user-agent'],
          ip: request.ip
        });
        
        reply.code(400).send({
          error: 'Bad Request',
          message: 'Product ID must be a positive integer'
        });
        return;
      }

      fastify.log.info('Fetching product by ID', {
        productId,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });

      const result = await executeQuery(
        fastify,
        'SELECT * FROM products WHERE id = $1',
        [productId],
        'fetching product by ID'
      );

      if (!result.rows.length) {
        fastify.log.info('Product not found', { productId });
        
        reply.code(404).send({
          error: 'Not Found',
          message: `Product with ID ${productId} not found`
        });
        return;
      }

      const product = result.rows[0];
      
      reply.header('X-Response-Time', `${Date.now() - startTime}ms`);
      
      fastify.log.info('Product fetched successfully', {
        productId,
        productName: product.name,
        responseTime: `${Date.now() - startTime}ms`
      });

      return product;

    } catch (error) {
      fastify.log.error('Error fetching product by ID:', {
        error: error.message,
        stack: error.stack,
        params: request.params,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });

      reply.code(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch product',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });


  /**
   * GET /api/products/latest
   * Retrieve the latest products (most recently added)
   * 
   * Query Parameters:
   * - limit: Number of latest products to return (default: 10, max: 50)
   * 
   * Response:
   * - products: Array of latest product objects
   * - limit: Number of products returned
   * - total: Total number of products available
   */
  fastify.get('/latest', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          limit: { 
            type: 'string', 
            pattern: '^[1-9]\\d*$',
            description: 'Number of latest products (must be positive integer, max 50)'
          }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            products: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'integer' },
                  name: { type: 'string' },
                  description: { type: 'string' },
                  price: { type: 'number' },
                  image_url: { type: 'string' },
                  stock: { type: 'integer' },
                  created_at: { type: 'string' }
                }
              }
            },
            limit: { type: 'integer' },
            total: { type: 'integer' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const startTime = Date.now();
    
    try {
      // Validate and sanitize input parameters
      let limit = parseInt(request.query.limit) || 8;
      
      // Validate limit
      if (limit < 1) {
        throw new Error('Limit must be greater than 0');
      }
      if (limit > 50) {
        throw new Error('Limit cannot exceed 50 items');
      }
      
      fastify.log.info('Fetching latest products', {
        limit,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });

      // Generate cache key
      const cacheKey = `products:latest:limit:${limit}`;
      
      // Try to get data from Redis cache first
      try {
        const cachedData = await fastify.redis.get(cacheKey);
        if (cachedData) {
          fastify.log.info('Cache hit for latest products', { cacheKey, limit });
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
      fastify.log.info('Cache miss, fetching latest products from database', { cacheKey, limit });
      
      // Get latest products ordered by ID (assuming ID is auto-increment)
      // If you have a created_at timestamp, use that instead: ORDER BY created_at DESC
      const result = await executeQuery(
        fastify,
        'SELECT id, name, description, price, image_url, stock FROM products ORDER BY id DESC LIMIT $1',
        [limit],
        'fetching latest products'
      );

      // Get total count for reference
      const countResult = await executeQuery(
        fastify,
        'SELECT COUNT(*) as total FROM products',
        [],
        'counting total products'
      );

      const total = parseInt(countResult.rows[0].total);
      
      const response = {
        products: result.rows,
        limit,
        total
      };

      // Cache the result in Redis for 30 seconds (shorter TTL for latest products)
      try {
        await fastify.redis.set(cacheKey, JSON.stringify(response), 'EX', 30);
        fastify.log.info('Cached latest products data', { cacheKey, ttl: 30 });
      } catch (cacheError) {
        fastify.log.warn('Failed to cache latest products data', {
          error: cacheError.message,
          cacheKey
        });
      }

      reply.header('X-Cache', 'MISS');
      reply.header('X-Response-Time', `${Date.now() - startTime}ms`);
      
      fastify.log.info('Latest products fetched successfully', {
        count: result.rows.length,
        limit,
        responseTime: `${Date.now() - startTime}ms`
      });

      return response;

    } catch (error) {
      fastify.log.error('Error fetching latest products:', {
        error: error.message,
        stack: error.stack,
        query: request.query,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });

      // Determine appropriate error response
      if (error.message.includes('Limit must be') || 
          error.message.includes('Limit cannot exceed')) {
        reply.code(400).send({
          error: 'Bad Request',
          message: error.message,
          details: 'Invalid limit parameter'
        });
      } else {
        reply.code(500).send({
          error: 'Internal Server Error',
          message: 'Failed to fetch latest products',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
      }
    }
  });


}
  