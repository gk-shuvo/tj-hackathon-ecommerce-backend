DO $$
BEGIN
  FOR i IN 1..100000 LOOP
    INSERT INTO products (name, description, price, image_url)
    VALUES (
      'Product ' || i,
      'Description for product ' || i,
      round((random() * 100 + 1)::numeric, 2),
      'https://example.com/img' || i || '.jpg'
    );
  END LOOP;
END
$$;