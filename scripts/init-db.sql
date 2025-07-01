CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC,
  image_url TEXT
);

-- Example insert
INSERT INTO products (name, description, price, image_url)
VALUES
('Sample Product 1', 'A great product.', 29.99, 'https://example.com/img1.jpg'),
('Sample Product 2', 'Another product.', 19.99, 'https://example.com/img2.jpg');
