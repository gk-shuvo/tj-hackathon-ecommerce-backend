# k6 Performance Testing Script for E-commerce API

## 🎯 Overview

This k6 script is designed to test the performance of your e-commerce API according to the hackathon evaluation criteria. It simulates realistic user behavior and measures key performance metrics that will be used for scoring.

## 📊 What This Script Tests

### API Endpoints Covered
1. **`GET /api/products`** - Product listing with pagination (40% of requests)
2. **`GET /api/products/:id`** - Product detail by ID (30% of requests)
3. **`GET /api/products/search`** - Product search with full-text search (20% of requests)
4. **`GET /api/products/latest`** - Latest products (10% of requests)

### Load Patterns
- **Warm-up Phase**: 1 minute of light load to warm up caches
- **Main Load Test**: Ramps up to 1000 concurrent users over 22 minutes
- **Spike Test**: Sudden load spikes to test system resilience

## 🚀 How to Run the Test

### Prerequisites
1. Install k6: https://k6.io/docs/getting-started/installation/
2. Ensure your API is running and accessible
3. Make sure you have the required data in your database

### Basic Usage
```bash
# Test against localhost:3000 (default)
k6 run k6-performance-test.js

# Test against a specific URL
k6 run -e BASE_URL=http://your-api-url:port k6-performance-test.js

# Run with verbose output
k6 run --verbose k6-performance-test.js

# Generate JSON results
k6 run --out json=results.json k6-performance-test.js

# Generate InfluxDB output (if you have InfluxDB)
k6 run --out influxdb=http://localhost:8086/k6 k6-performance-test.js
```

### Advanced Usage
```bash
# Run only specific scenarios
k6 run --stage 30s:100 k6-performance-test.js

# Run with custom environment variables
k6 run -e BASE_URL=http://your-api.com -e TEST_DURATION=10m k6-performance-test.js

# Run with different load patterns
k6 run -e VUS=500 -e DURATION=5m k6-performance-test.js
```

## 📈 Performance Metrics Measured

### Primary Metrics (Hackathon Evaluation)
1. **Requests per second** - Target: >100 RPS
2. **Median response time** - Target: <200ms
3. **95th percentile response time** - Target: <500ms
4. **Error rate** - Target: <1%

### Custom Metrics
- **Cache hit rate** - Measures Redis caching effectiveness
- **Cache miss rate** - Tracks database query frequency
- **Response time trends** - Detailed timing analysis
- **Throughput trends** - Request volume over time

### System Metrics (Resource Efficiency)
- CPU usage during load test
- Memory usage during load test
- Network I/O patterns

## 🎯 Hackathon Scoring Criteria

### Backend Performance (25 points)
This script directly tests the metrics used for scoring:

| Metric | Target | Points |
|--------|--------|--------|
| Requests per second | >100 RPS | 5 points |
| Median response time | <200ms | 5 points |
| 95th percentile | <500ms | 10 points |
| Error rate | <1% | 5 points |

### Resource Efficiency (20 points)
Monitor these during the test:
- Peak CPU usage should stay under 80%
- Peak memory usage should stay under 3GB
- Efficient resource utilization

## 📋 Test Scenarios Explained

### 1. Warm-up Phase (1 minute)
- **Purpose**: Warm up caches and prepare the system
- **Load**: 1-10 virtual users
- **Duration**: 1 minute
- **Goal**: Establish baseline performance

### 2. Main Load Test (22 minutes)
- **Purpose**: Comprehensive performance testing
- **Load**: Ramps from 50 to 1000 virtual users
- **Stages**:
  - 0-2min: 50 → 200 users
  - 2-5min: 200 → 500 users
  - 5-10min: 500 → 1000 users
  - 10-20min: 1000 users (steady state)
  - 20-22min: 1000 → 0 users (ramp down)

### 3. Spike Test (2 minutes)
- **Purpose**: Test system resilience under sudden load
- **Load**: Sudden spike to 100 users, then back to normal
- **Goal**: Ensure system handles traffic spikes gracefully

## 🔍 Interpreting Results

### Good Performance Indicators
- ✅ 95th percentile response time < 500ms
- ✅ Error rate < 1%
- ✅ Requests per second > 100
- ✅ Cache hit rate > 30%
- ✅ Consistent response times across all endpoints

### Performance Issues to Watch
- ❌ Response times increasing over time
- ❌ High error rates (>5%)
- ❌ Cache miss rate > 70%
- ❌ Inconsistent performance across endpoints

### Sample Output Analysis
```
http_req_duration..............: avg=150ms    min=50ms     med=120ms    max=800ms    p(95)=400ms   p(99)=650ms
http_reqs......................: rate=150.5/s
errors.........................: rate=0.002   (0.2%)
cache_hits.....................: rate=0.45    (45%)
cache_misses..................: rate=0.55    (55%)
```

## 🛠️ Troubleshooting

### Common Issues

1. **Connection Refused**
   ```bash
   # Check if your API is running
   curl http://localhost:3000/health
   ```

2. **High Error Rates**
   - Check database connectivity
   - Verify Redis is running
   - Check application logs

3. **Slow Response Times**
   - Optimize database queries
   - Check Redis cache configuration
   - Monitor system resources

4. **Memory Issues**
   - Reduce concurrent users
   - Check for memory leaks
   - Optimize database connection pooling

### Performance Optimization Tips

1. **Database Optimization**
   - Ensure proper indexes on product tables
   - Optimize search queries
   - Use connection pooling

2. **Caching Strategy**
   - Implement Redis caching for frequently accessed data
   - Set appropriate TTL values
   - Cache search results

3. **API Optimization**
   - Use compression (gzip)
   - Implement pagination
   - Optimize response payloads

## 📊 Monitoring During Test

### Real-time Monitoring
```bash
# Watch system resources
htop
# or
top

# Monitor network
iftop
# or
nethogs

# Check application logs
tail -f your-app.log
```

### Key Metrics to Watch
- CPU usage (should stay under 80%)
- Memory usage (should stay under 3GB)
- Database connection count
- Redis memory usage
- Network I/O

## 🎉 Success Criteria

Your application is performing well if:
- ✅ All thresholds are met
- ✅ Response times are consistent
- ✅ Error rate is minimal
- ✅ Cache hit rate is good
- ✅ System resources are stable

## 📝 Notes for Hackathon

1. **Test Environment**: Ensure your test environment matches production constraints (2 vCPU, 4GB RAM)
2. **Data Volume**: The script assumes you have at least 1000 products in your database
3. **Network**: Run k6 on the same network as your API for accurate results
4. **Baseline**: Run the test multiple times to establish a baseline
5. **Documentation**: Keep track of your optimization strategies

## 🔗 Additional Resources

- [k6 Documentation](https://k6.io/docs/)
- [k6 Examples](https://github.com/grafana/k6-examples)
- [Performance Testing Best Practices](https://k6.io/docs/testing-guides/)
- [Hackathon Participant Guide](your-hackathon-guide-link)

---

**Good luck with your hackathon! 🚀** 