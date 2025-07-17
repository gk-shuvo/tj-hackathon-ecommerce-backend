-- PostgreSQL Full-Text Search Indexes for Products Table
-- This script adds the necessary indexes for efficient product search functionality

-- Enable the pg_trgm extension for trigram matching (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create a combined text search vector column for better performance
-- This pre-computes the search vector for name and description
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create a function to update the search vector
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.name, '') || ' ' || COALESCE(NEW.description, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search vector
DROP TRIGGER IF EXISTS products_search_vector_trigger ON products;
CREATE TRIGGER products_search_vector_trigger
  BEFORE INSERT OR UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION products_search_vector_update();

-- Update existing records to populate search vector
UPDATE products SET search_vector = to_tsvector('english', COALESCE(name, '') || ' ' || COALESCE(description, ''))
WHERE search_vector IS NULL;

-- Create GIN index on the search vector for fast full-text search
CREATE INDEX IF NOT EXISTS products_search_vector_idx ON products USING gin(search_vector);

-- Create GIN index on name for trigram matching (fuzzy search)
CREATE INDEX IF NOT EXISTS products_name_trgm_idx ON products USING gin(name gin_trgm_ops);

-- Create GIN index on description for trigram matching (fuzzy search)
CREATE INDEX IF NOT EXISTS products_description_trgm_idx ON products USING gin(description gin_trgm_ops);

-- Create composite index for name and description trigram matching
CREATE INDEX IF NOT EXISTS products_name_description_trgm_idx ON products USING gin((name || ' ' || COALESCE(description, '')) gin_trgm_ops);

-- Create index on price for potential price-based filtering
CREATE INDEX IF NOT EXISTS products_price_idx ON products(price);

-- Create index on id for fast lookups
CREATE INDEX IF NOT EXISTS products_id_idx ON products(id);

-- Analyze the table to update statistics
ANALYZE products; 