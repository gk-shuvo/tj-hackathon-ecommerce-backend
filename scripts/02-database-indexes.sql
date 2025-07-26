-- Database Indexing Strategy for Hackathon Project Backend
-- This script creates optimal indexes for all API endpoints

-- =====================================================
-- PRODUCTS TABLE INDEXES
-- =====================================================

-- 1. PRIMARY INDEXES (High Priority)

-- Index for the 'index' field - used in multiple queries
-- This is the most critical index as it's used for:
-- - GET /api/products/:index (exact lookup)
-- - GET /api/products/search?search=123 (exact lookup)
-- - ORDER BY index in pagination queries
CREATE INDEX IF NOT EXISTS idx_products_index ON products(index);

-- Index for category filtering - used in category-based queries
-- Used in: GET /api/products/category/:categoryName
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Composite index for category + index ordering
-- Optimizes: WHERE category = ? ORDER BY index
CREATE INDEX IF NOT EXISTS idx_products_category_index ON products(category, index);

-- 2. SORTING INDEXES (Medium Priority)

-- Index for latest products query (ORDER BY index DESC)
-- Used in: GET /api/products/latest
CREATE INDEX IF NOT EXISTS idx_products_index_desc ON products(index DESC);

-- Index for pagination (ORDER BY index ASC)
-- Used in: GET /api/products (main pagination)
CREATE INDEX IF NOT EXISTS idx_products_index_asc ON products(index ASC);


-- =====================================================
-- CATEGORIES TABLE INDEXES
-- =====================================================

-- Index for category name lookups (already has UNIQUE constraint, but explicit index for clarity)
-- Used in: GET /api/categories (ORDER BY name ASC)
CREATE INDEX IF NOT EXISTS idx_categories_name_asc ON categories(name ASC);

-- Index for category name case-insensitive searches (if needed)
-- This creates a functional index for LOWER(name) comparisons
CREATE INDEX IF NOT EXISTS idx_categories_name_lower ON categories(LOWER(name));