import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  vus: 1000,        // simulate 1000 concurrent users
  duration: '30s',  // run for 30 seconds
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE_URL = 'http://localhost:3000'; // Change to your deployed URL

export default function () {
  const randomProductId = Math.floor(Math.random() * 1000) + 1;   // 1–1000
  const randomIndexQuery = Math.floor(Math.random() * 1000) + 1;  // 1–1000
  const page = Math.floor(Math.random() * 20) + 1;                // 1–20 pages

  const endpoints = [
    `/api/products?page=${page}&limit=50`,                  // paginated list
    `/api/products/${randomProductId}`,                     // product details
    `/api/products/search?search=${randomIndexQuery}`,      // search by index
    `/api/products/latest`,                                 // latest
  ];

  const url = `${BASE_URL}${endpoints[Math.floor(Math.random() * endpoints.length)]}`;
  const res = http.get(url);

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1); // optional: simulate delay between user actions
}
