/**
 * Middleware utilities
 * 
 * Provides common middleware functions for:
 * - Request logging and monitoring
 * - Rate limiting
 * - Security headers
 * - Request timing
 * 
 * @author Hackathon Team
 * @version 1.0.0
 */

/**
 * Request logging middleware
 * Logs detailed information about incoming requests
 * @param {Object} fastify - Fastify instance
 */
export function requestLogger(fastify) {
  return (request, reply, done) => {
    const startTime = process.hrtime.bigint();
    
    // Store start time for response logging
    request.startTime = startTime;
    
    // Log request details
    fastify.log.info('Incoming request', {
      method: request.method,
      url: request.url,
      path: request.routerPath,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      referer: request.headers.referer,
      contentType: request.headers['content-type'],
      contentLength: request.headers['content-length'],
      query: Object.keys(request.query).length > 0 ? request.query : undefined,
      params: Object.keys(request.params).length > 0 ? request.params : undefined
    });
    
    done();
  };
}

/**
 * Response logging middleware
 * Logs response details and timing information
 * @param {Object} fastify - Fastify instance
 */
export function responseLogger(fastify) {
  return (request, reply, done) => {
    // Calculate response time using hrtime for precision
    const endTime = process.hrtime.bigint();
    const duration = Number(endTime - request.startTime) / 1000000; // Convert to milliseconds
    
    // Add response time header
    reply.header('X-Response-Time', `${duration.toFixed(2)}ms`);
    reply.header('X-Processing-Time', `${duration.toFixed(2)}ms`);
    
    // Log slow requests
    if (duration > 1000) { // Log requests taking more than 1 second
      fastify.log.warn('Slow request detected', {
        method: request.method,
        url: request.url,
        duration: `${duration.toFixed(2)}ms`,
        ip: request.ip
      });
    }
    
    // Log response details
    fastify.log.info('Response sent', {
      method: request.method,
      url: request.url,
      path: request.routerPath,
      statusCode: reply.statusCode,
      responseTime: `${duration.toFixed(2)}ms`,
      contentLength: reply.getHeader('content-length'),
      contentType: reply.getHeader('content-type')
    });
    
    done();
  };
}

/**
 * Security headers middleware
 * Adds security-related headers to responses
 * @param {Object} fastify - Fastify instance
 */
export function securityHeaders(fastify) {
  return (request, reply, done) => {
    // Security headers
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('X-Frame-Options', 'DENY');
    reply.header('X-XSS-Protection', '1; mode=block');
    reply.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Remove server information
    reply.header('Server', 'Fastify API');
    
    done();
  };
}

/**
 * Simple rate limiting middleware
 * Basic rate limiting based on IP address
 * @param {Object} fastify - Fastify instance
 * @param {Object} options - Rate limiting options
 */
export function rateLimiter(fastify, options = {}) {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    maxRequests = 10000, // max requests per window
    skipSuccessfulRequests = false,
    skipFailedRequests = false
  } = options;

  const requests = new Map();

  // Clean up old entries periodically
  setInterval(() => {
    const now = Date.now();
    for (const [key, data] of requests.entries()) {
      if (now - data.windowStart > windowMs) {
        requests.delete(key);
      }
    }
  }, windowMs);

  return (request, reply, done) => {
    const key = request.ip;
    const now = Date.now();
    
    if (!requests.has(key)) {
      requests.set(key, {
        count: 1,
        windowStart: now
      });
    } else {
      const data = requests.get(key);
      
      // Reset window if expired
      if (now - data.windowStart > windowMs) {
        data.count = 1;
        data.windowStart = now;
      } else {
        data.count++;
      }
      
      // Check if rate limit exceeded
      if (data.count > maxRequests) {
        fastify.log.warn('Rate limit exceeded', {
          ip: key,
          count: data.count,
          maxRequests,
          windowMs
        });
        
        reply.code(429).send({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded',
          retryAfter: Math.ceil(windowMs / 1000)
        });
        return;
      }
    }
    
    done();
  };
}

/**
 * Request timing middleware
 * Measures and logs request processing time
 * @param {Object} fastify - Fastify instance
 */
export function requestTimer(fastify) {
  return (request, reply, done) => {
    const startTime = process.hrtime.bigint();
    
    // Store start time in request for later use
    request.startTime = startTime;
    
    // Add timing header in onResponse hook
    reply.header('X-Processing-Time', '0ms'); // Placeholder, will be updated
    
    done();
  };
}

/**
 * Error tracking middleware
 * Tracks and logs errors with additional context
 * @param {Object} fastify - Fastify instance
 */
export function errorTracker(fastify) {
  return (error, request, reply, done) => {
    // Add request context to error
    error.requestContext = {
      method: request.method,
      url: request.url,
      ip: request.ip,
      userAgent: request.headers['user-agent'],
      timestamp: new Date().toISOString()
    };
    
    // Log error with context
    fastify.log.error('Request error occurred:', {
      error: error.message,
      stack: error.stack,
      statusCode: error.statusCode || 500,
      requestContext: error.requestContext
    });
    
    done();
  };
}

/**
 * Request validation middleware
 * Validates request headers and basic request structure
 * @param {Object} fastify - Fastify instance
 */
export function requestValidator(fastify) {
  return (request, reply, done) => {
    // Check for required headers
    const requiredHeaders = ['user-agent'];
    const missingHeaders = requiredHeaders.filter(header => !request.headers[header]);
    
    if (missingHeaders.length > 0) {
      fastify.log.warn('Missing required headers', {
        missingHeaders,
        ip: request.ip,
        url: request.url
      });
    }
    
    // Validate content length for POST/PUT requests
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      const contentLength = parseInt(request.headers['content-length'] || '0');
      const maxLength = 10 * 1024 * 1024; // 10MB
      
      if (contentLength > maxLength) {
        fastify.log.warn('Request too large', {
          contentLength,
          maxLength,
          ip: request.ip,
          url: request.url
        });
        
        reply.code(413).send({
          error: 'Payload Too Large',
          message: 'Request body too large'
        });
        return;
      }
    }
    
    done();
  };
} 

/**
 * Request queue management middleware
 * Handles backpressure and prevents overwhelming the system during high load
 * @param {Object} fastify - Fastify instance
 * @param {Object} options - Queue options
 */
export function requestQueueManager(fastify, options = {}) {
  const {
    maxConcurrentRequests = 1000,
    queueTimeout = 30000, // 30 seconds
    enableQueue = process.env.ENABLE_REQUEST_QUEUE === 'true'
  } = options;

  let activeRequests = 0;
  const requestQueue = [];
  let isProcessingQueue = false;

  const processQueue = async () => {
    if (isProcessingQueue || requestQueue.length === 0) return;
    
    isProcessingQueue = true;
    
    while (requestQueue.length > 0 && activeRequests < maxConcurrentRequests) {
      const { request, reply, done, timestamp } = requestQueue.shift();
      
      // Check if request has timed out
      if (Date.now() - timestamp > queueTimeout) {
        fastify.log.warn('Request timed out in queue', {
          url: request.url,
          method: request.method,
          queueTime: Date.now() - timestamp
        });
        
        reply.code(503).send({
          error: 'Service Unavailable',
          message: 'Request timed out in queue'
        });
        continue;
      }
      
      activeRequests++;
      done();
    }
    
    isProcessingQueue = false;
  };

  return (request, reply, done) => {
    if (!enableQueue || activeRequests < maxConcurrentRequests) {
      activeRequests++;
      done();
      return;
    }

    // Add request to queue
    const queueEntry = {
      request,
      reply,
      done: () => {
        activeRequests--;
        processQueue(); // Process next request in queue
      },
      timestamp: Date.now()
    };

    requestQueue.push(queueEntry);
    
    // Add queue position header
    reply.header('X-Queue-Position', requestQueue.length);
    reply.header('X-Queue-Wait-Time', Date.now() - queueEntry.timestamp);
    
    fastify.log.info('Request queued', {
      url: request.url,
      method: request.method,
      queuePosition: requestQueue.length,
      activeRequests
    });

    // Process queue if not already processing
    if (!isProcessingQueue) {
      processQueue();
    }
  };
} 