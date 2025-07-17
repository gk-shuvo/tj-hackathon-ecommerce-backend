/**
 * Database seeding script
 * 
 * This script clears all existing products from the database
 * and inserts products from the products.json file.
 * 
 * Usage: node scripts/seed-from-json.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Database connection function
 * @returns {Promise<Object>} Database client
 */
async function getDatabaseConnection() {
  const { Client } = await import('pg');
  
  const client = new Client({
    connectionString: process.env.DB_CONNECTION_STRING
  });
  
  await client.connect();
  return client;
}

/**
 * Clear all existing products from the database
 * @param {Object} client - Database client
 */
async function clearProducts(client) {
  console.log('🗑️  Clearing existing products...');
  
  try {
    const result = await client.query('DELETE FROM products');
    console.log(`✅ Cleared ${result.rowCount} existing products`);
    await client.query('ALTER SEQUENCE products_id_seq RESTART WITH 1');
    console.log('✅ Reset products_id_seq');
  } catch (error) {
    console.error('❌ Error clearing products:', error.message);
    throw error;
  }
}

/**
 * Insert products from JSON file into database
 * @param {Object} client - Database client
 * @param {Array} products - Array of product objects
 */
async function insertProducts(client, products) {
  console.log(`📦 Inserting ${products.length} products...`);
  
  try {
    // Prepare the insert query
    const insertQuery = `
      INSERT INTO products (name, index, description, price, image_url, brand, category, stock, ean, color, size, availability, short_description, internal_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `;
    
    let insertedCount = 0;
    
    // Insert products in batches to avoid memory issues
    const batchSize = 100;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      for (const product of batch) {
        try {
          await client.query(insertQuery, [
            product.Name,
            product.Index,
            product.Description,
            product.Price,
            product.Image,
            product.Brand,
            product.Category,
            product.Stock,
            product.EAN,
            product.Color,
            product.Size,
            product.Availability,
            product.ShortDescription,
            product['Internal ID']
          ]);
          insertedCount++;
        } catch (error) {
          console.error(`❌ Error inserting product ${product.Index}:`, error.message);
          // Continue with other products even if one fails
        }
      }
      
      // Progress update
      if (i % 1000 === 0) {
        console.log(`📊 Progress: ${insertedCount}/${products.length} products inserted`);
      }
    }
    
    console.log(`✅ Successfully inserted ${insertedCount} products`);
    return insertedCount;
    
  } catch (error) {
    console.error('❌ Error inserting products:', error.message);
    throw error;
  }
}

/**
 * Update database schema to include new columns if they don't exist
 * @param {Object} client - Database client
 */
async function updateSchema(client) {
  console.log('🔧 Updating database schema...');
  
  try {
    // Add new columns if they don't exist
    const alterQueries = [
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS brand TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS category TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS stock INTEGER',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS ean BIGINT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS color TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS size TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS availability TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS short_description TEXT',
      'ALTER TABLE products ADD COLUMN IF NOT EXISTS internal_id TEXT'
    ];
    
    for (const query of alterQueries) {
      await client.query(query);
    }
    
    console.log('✅ Database schema updated');
  } catch (error) {
    console.error('❌ Error updating schema:', error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  let client;
  
  try {
    console.log('🚀 Starting database seeding process...');
    
    // Check if products.json exists
    const productsPath = path.join(__dirname, '..', 'products.json');
    if (!fs.existsSync(productsPath)) {
      throw new Error('products.json file not found');
    }
    
    // Read products from JSON file
    console.log('📖 Reading products from products.json...');
    const productsData = fs.readFileSync(productsPath, 'utf8');
    const products = JSON.parse(productsData);
    
    console.log(`📊 Found ${products.length} products in JSON file`);
    
    // Connect to database
    console.log('🔌 Connecting to database...');
    client = await getDatabaseConnection();
    console.log('✅ Connected to database');
    
    // Update schema if needed
    await updateSchema(client);
    
    // Clear existing products
    await clearProducts(client);
    
    // Insert new products
    const insertedCount = await insertProducts(client, products);
    
    // Verify the insertion
    const countResult = await client.query('SELECT COUNT(*) FROM products');
    const totalProducts = parseInt(countResult.rows[0].count);
    
    console.log('\n🎉 Seeding completed successfully!');
    console.log(`📊 Total products in database: ${totalProducts}`);
    console.log(`✅ Products inserted: ${insertedCount}`);
    
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  } finally {
    if (client) {
      await client.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
main(); 