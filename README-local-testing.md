# Local Testing Guide for Automatic Restart

This guide explains how to test the automatic restart functionality locally before deploying to GCP.

## Prerequisites

- Docker Desktop installed and running
- Docker Compose installed
- Git Bash (for Windows) or Terminal (for Mac/Linux)

## Quick Test (Windows PowerShell)

If you're on Windows, you can run the PowerShell test script:

```powershell
.\test-local-restart.ps1
```

## Quick Test (Linux/Mac/Windows Git Bash)

If you're on Linux, Mac, or using Git Bash on Windows:

```bash
chmod +x test-local-restart.sh
./test-local-restart.sh
```

## What the Test Does

The test script simulates exactly what happens when a GCP instance is turned off and on again:

### 1. **Initial Setup**
- Builds all Docker containers
- Starts all services (API, PostgreSQL, Redis)
- Waits for health checks to pass

### 2. **API Testing**
- Tests the health endpoint (`/health`)
- Tests the products endpoint (`/api/products`)
- Verifies all endpoints are working

### 3. **Restart Simulation**
- Stops all containers (simulating power off)
- Starts all containers again (simulating power on)
- Waits for services to become healthy again
- Tests API endpoints after restart

### 4. **Graceful Shutdown Testing**
- Sends SIGTERM signals to containers
- Tests graceful shutdown handling
- Restarts services and verifies recovery

### 5. **Final Verification**
- Shows final container status
- Confirms all services are healthy
- Provides summary of all tests

## Manual Testing Steps

If you prefer to test manually:

### Step 1: Start Services
```bash
docker-compose down --volumes --remove-orphans
docker-compose build --no-cache
docker-compose up -d
```

### Step 2: Wait for Health Checks
```bash
docker-compose ps
```
Wait until all services show "healthy" status.

### Step 3: Test API
```bash
curl http://localhost:3000/health
curl http://localhost:3000/api/products
```

### Step 4: Simulate Restart
```bash
docker-compose down
docker-compose up -d
```

### Step 5: Verify Recovery
```bash
docker-compose ps
curl http://localhost:3000/health
```

## Expected Results

✅ **All tests should pass** if your setup is working correctly:

- Services start automatically
- Health checks work properly
- API endpoints are accessible
- Services restart after power cycle simulation
- Graceful shutdown works
- Services recover after graceful shutdown

## Troubleshooting

### Services Not Becoming Healthy

1. **Check logs**:
   ```bash
   docker-compose logs
   ```

2. **Check individual service logs**:
   ```bash
   docker-compose logs api
   docker-compose logs db
   docker-compose logs redis
   ```

3. **Verify Docker is running**:
   ```bash
   docker info
   ```

### API Endpoints Not Responding

1. **Check if API is running**:
   ```bash
   docker-compose ps api
   ```

2. **Check API logs**:
   ```bash
   docker-compose logs api
   ```

3. **Test with curl**:
   ```bash
   curl -v http://localhost:3000/health
   ```

### Database Connection Issues

1. **Check database logs**:
   ```bash
   docker-compose logs db
   ```

2. **Verify database is ready**:
   ```bash
   docker-compose exec db pg_isready -U postgres
   ```

## Test Output Example

When the test passes successfully, you should see output like:

```
🧪 Testing Automatic Restart Functionality Locally
==================================================
✅ Docker is running
✅ docker-compose is available

📦 Step 1: Building and starting services...
⏳ Waiting for services to be healthy...
✅ All services are healthy!

🔍 Step 2: Testing API endpoints...
✅ Health endpoint is working
✅ Products endpoint is working

🔄 Step 3: Simulating system restart...
✅ All services are healthy after restart!
✅ Health endpoint is working after restart
✅ Products endpoint is working after restart

🛑 Step 5: Testing graceful shutdown...
✅ All services are healthy after graceful shutdown!
✅ Final health check passed

🎉 All tests passed! Your application handles restarts correctly.
```

## Next Steps

Once all tests pass locally:

1. **Deploy to GCP** with the updated configuration
2. **Run the setup script** on your GCP instance
3. **Test by rebooting** your GCP instance
4. **Monitor the logs** to ensure everything starts correctly

Your application is now ready for production deployment! 🚀 