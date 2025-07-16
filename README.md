# Fastify API

A high-performance, production-ready Fastify-based REST API with PostgreSQL database, Redis caching, comprehensive error handling, and monitoring capabilities.

## Features

- **Fastify** - High-performance web framework
- **PostgreSQL** - Primary database with connection pooling
- **Redis** - Caching layer for improved performance
- **Docker** - Containerized deployment
- **CORS** - Cross-origin resource sharing
- **Compression** - Response compression
- **Comprehensive Error Handling** - Centralized error management with custom error classes
- **Structured Logging** - Detailed request/response logging with context
- **Health Monitoring** - Health check endpoints for application monitoring
- **Rate Limiting** - Built-in rate limiting to prevent abuse
- **Security Headers** - Security-focused response headers
- **Request Validation** - Input validation and sanitization
- **Performance Monitoring** - Request timing and slow request detection

## Environment Variables

Create a `.env` file with the following variables:

```env
PORT=3000
DB_CONNECTION_STRING=postgres://postgres:postgres@localhost:5432/ecommerce
REDIS_URL=redis://localhost:6379
NODE_ENV=development
LOG_LEVEL=info
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Running the Application

### With Docker (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Check application health
curl http://localhost:3000/health
```

### Local Development

```bash
# Install dependencies
npm install

# Start PostgreSQL and Redis (using Docker)
docker-compose up -d db redis

# Start the API
npm run dev
```

## API Endpoints

### Health Checks

- `GET /health` - Basic health check
- `GET /health/detailed` - Detailed health check with dependency status
- `GET /health/ready` - Readiness check for container orchestration

### Products

- `GET /api/products` - Get paginated product list
- `GET /api/products/:id` - Get product by ID
- `GET /api/products/search` - Search products using PostgreSQL full-text search

### Query Parameters

**For `/api/products`:**
- `page` - Page number (default: 1, must be positive integer)
- `limit` - Items per page (default: 10, max: 100, must be positive integer)

**For `/api/products/search`:**
- `search` - Search term for product name and description (required, 1-100 characters)
- `page` - Page number (default: 1, must be positive integer)
- `limit` - Items per page (default: 10, max: 100, must be positive integer)

### Response Headers

The API includes several custom headers for monitoring and debugging:

- `X-Response-Time` - Request processing time in milliseconds
- `X-Processing-Time` - High-precision processing time
- `X-Cache` - Cache status (HIT/MISS)
- `X-Content-Type-Options` - Security header
- `X-Frame-Options` - Security header
- `X-XSS-Protection` - Security header

## Error Handling

The application implements comprehensive error handling with:

### Custom Error Classes

- `ValidationError` - Input validation errors (400)
- `DatabaseError` - Database operation errors (500)
- `CacheError` - Redis cache errors (500)
- `NotFoundError` - Resource not found errors (404)

### Error Response Format

```json
{
  "error": "Error Type",
  "message": "Human-readable error message",
  "statusCode": 400,
  "details": "Additional error details (development only)"
}
```

### Error Logging

All errors are logged with structured information including:
- Error message and stack trace
- Request context (URL, method, IP, user agent)
- Database error codes and details
- Timestamp and correlation information

## Monitoring and Observability

### Health Checks

The application provides multiple health check endpoints:

- **Basic Health Check** (`/health`) - Quick application status
- **Detailed Health Check** (`/health/detailed`) - Status of all dependencies
- **Readiness Check** (`/health/ready`) - For Kubernetes/container orchestration

### Logging

Structured logging is implemented throughout the application:

- **Request Logging** - Incoming request details with context
- **Response Logging** - Response status and timing information
- **Error Logging** - Detailed error information with stack traces
- **Performance Logging** - Slow request detection and timing

### Rate Limiting

Built-in rate limiting to prevent API abuse:
- 100 requests per 15-minute window per IP address
- Configurable limits and time windows
- Automatic cleanup of expired entries

## Project Structure

```
src/
├── routes/
│   ├── products.js       # Product routes with validation
│   └── health.js         # Health check routes
├── plugins/
│   └── redis.js          # Redis plugin with error handling
├── utils/
│   ├── errorHandler.js   # Error handling utilities
│   └── middleware.js     # Common middleware functions
└── server.js             # Main server with comprehensive setup
```

## Development

The API is built with:
- **Fastify** for the web framework
- **PostgreSQL** for data storage with connection pooling
- **Redis** for caching with health monitoring
- **Docker** for containerization
- **Comprehensive error handling** for production reliability
- **Structured logging** for debugging and monitoring

## Performance Features

- **Redis Caching** - Product listings cached for 60 seconds
- **Connection Pooling** - PostgreSQL connection management
- **Response Compression** - Automatic compression for large responses
- **Request Timing** - High-precision request timing measurement
- **Slow Request Detection** - Automatic logging of slow requests (>1s)

## Security Features

- **Input Validation** - Comprehensive parameter validation
- **Security Headers** - XSS protection, content type options
- **Rate Limiting** - Protection against abuse
- **Request Size Limits** - 10MB maximum request size
- **Error Sanitization** - No sensitive information in error responses

## Database

The application uses a `products` table with full-text search capabilities:

```sql
CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  image_url TEXT,
  search_vector tsvector  -- Pre-computed search vector for performance
);

-- Full-text search indexes for optimal performance
CREATE INDEX products_search_vector_idx ON products USING gin(search_vector);
CREATE INDEX products_name_trgm_idx ON products USING gin(name gin_trgm_ops);
CREATE INDEX products_description_trgm_idx ON products USING gin(description gin_trgm_ops);
```

### Search Setup

Run the search indexes script to enable full-text search:

```bash
# Apply search indexes
psql -d your_database -f scripts/search-indexes.sql
```

Sample data is automatically seeded with 100,000 products for testing. 