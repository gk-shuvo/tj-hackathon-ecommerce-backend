import { executeQuery } from '../utils/database.js';

export default async function statisticsRoutes(fastify, opts) {
  // --- Product Statistics CSV Download Endpoint ---
  fastify.get('/download', async (request, reply) => {
    try {
      // Calculate all statistics in a single query for efficiency
      const statsQuery = `
        SELECT
          (SELECT COUNT(*) FROM products) AS total_products,
          (SELECT COUNT(DISTINCT brand) FROM products) AS unique_brands,
          (SELECT COUNT(DISTINCT category) FROM products) AS unique_categories,
          (SELECT ROUND(AVG(price)::numeric, 2) FROM products) AS average_price,
          (SELECT MIN(price) FROM products) AS price_min,
          (SELECT MAX(price) FROM products) AS price_max,
          (SELECT COUNT(*) FROM products WHERE LOWER(availability) = 'in_stock') AS in_stock_count,
          (SELECT COUNT(*) FROM products WHERE LOWER(availability) = 'limited_stock') AS limited_stock_count,
          (SELECT COUNT(*) FROM products WHERE LOWER(availability) = 'out_of_stock') AS out_of_stock_count
      `;
      const result = await executeQuery(fastify, statsQuery, [], 'fetching product statistics');
      const stats = result.rows[0];

      // Compose CSV content
      const csvRows = [
        'metric,value',
        `total_products,${stats.total_products}`,
        `unique_brands,${stats.unique_brands}`,
        `unique_categories,${stats.unique_categories}`,
        `average_price,${stats.average_price}`,
        `price_min,${stats.price_min}`,
        `price_max,${stats.price_max}`,
        `in_stock_count,${stats.in_stock_count}`,
        `limited_stock_count,${stats.limited_stock_count}`,
        `out_of_stock_count,${stats.out_of_stock_count}`
      ];
      const csvContent = csvRows.join('\n');

      reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', 'attachment; filename="product_statistics.csv"')
        .send(csvContent);
    } catch (error) {
      fastify.log.error('Error generating product statistics CSV:', {
        error: error.message,
        stack: error.stack,
        userAgent: request.headers['user-agent'],
        ip: request.ip
      });
      reply.code(500).send({
        
        error: 'Internal Server Error',
        message: 'Failed to generate product statistics report',
        details: error.message
      });
    }
  });
} 