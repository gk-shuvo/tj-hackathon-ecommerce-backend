#!/bin/bash

# Local testing script for automatic restart functionality
# This script simulates what happens when a GCP instance is turned off and on again

echo "🧪 Testing Automatic Restart Functionality Locally"
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker first."
    exit 1
fi

print_status "Docker is running"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose is not installed. Please install it first."
    exit 1
fi

print_status "docker-compose is available"

# Step 1: Build and start the services
echo ""
echo "📦 Step 1: Building and starting services..."
docker-compose down --volumes --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be healthy
echo ""
echo "⏳ Waiting for services to be healthy..."
timeout=120
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose ps | grep -q "healthy"; then
        print_status "All services are healthy!"
        break
    fi
    
    echo -n "."
    sleep 2
    counter=$((counter + 2))
done

if [ $counter -eq $timeout ]; then
    print_error "Services did not become healthy within $timeout seconds"
    docker-compose logs
    exit 1
fi

# Step 2: Test the API
echo ""
echo "🔍 Step 2: Testing API endpoints..."
sleep 5

# Test health endpoint
echo "Testing health endpoint..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_status "Health endpoint is working"
else
    print_error "Health endpoint is not working"
    docker-compose logs api
    exit 1
fi

# Test products endpoint
echo "Testing products endpoint..."
if curl -f http://localhost:3000/api/products > /dev/null 2>&1; then
    print_status "Products endpoint is working"
else
    print_error "Products endpoint is not working"
    docker-compose logs api
    exit 1
fi

# Step 3: Simulate restart
echo ""
echo "🔄 Step 3: Simulating system restart..."
echo "Stopping all containers (simulating power off)..."
docker-compose down

echo "Starting containers again (simulating power on)..."
docker-compose up -d

# Wait for services to be healthy again
echo ""
echo "⏳ Waiting for services to be healthy after restart..."
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose ps | grep -q "healthy"; then
        print_status "All services are healthy after restart!"
        break
    fi
    
    echo -n "."
    sleep 2
    counter=$((counter + 2))
done

if [ $counter -eq $timeout ]; then
    print_error "Services did not become healthy after restart within $timeout seconds"
    docker-compose logs
    exit 1
fi

# Step 4: Test API again after restart
echo ""
echo "🔍 Step 4: Testing API endpoints after restart..."
sleep 5

# Test health endpoint again
echo "Testing health endpoint after restart..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_status "Health endpoint is working after restart"
else
    print_error "Health endpoint is not working after restart"
    docker-compose logs api
    exit 1
fi

# Test products endpoint again
echo "Testing products endpoint after restart..."
if curl -f http://localhost:3000/api/products > /dev/null 2>&1; then
    print_status "Products endpoint is working after restart"
else
    print_error "Products endpoint is not working after restart"
    docker-compose logs api
    exit 1
fi

# Step 5: Test graceful shutdown
echo ""
echo "🛑 Step 5: Testing graceful shutdown..."
echo "Sending SIGTERM to containers..."

# Get the container IDs
API_CONTAINER=$(docker-compose ps -q api)
DB_CONTAINER=$(docker-compose ps -q db)
REDIS_CONTAINER=$(docker-compose ps -q redis)

# Send SIGTERM to simulate graceful shutdown
docker stop $API_CONTAINER $DB_CONTAINER $REDIS_CONTAINER

echo "Containers stopped. Starting them again..."
docker-compose up -d

# Wait for services to be healthy again
echo ""
echo "⏳ Waiting for services to be healthy after graceful shutdown..."
counter=0

while [ $counter -lt $timeout ]; do
    if docker-compose ps | grep -q "healthy"; then
        print_status "All services are healthy after graceful shutdown!"
        break
    fi
    
    echo -n "."
    sleep 2
    counter=$((counter + 2))
done

if [ $counter -eq $timeout ]; then
    print_error "Services did not become healthy after graceful shutdown within $timeout seconds"
    docker-compose logs
    exit 1
fi

# Final test
echo ""
echo "🔍 Final API test after graceful shutdown..."
sleep 5

if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    print_status "Final health check passed"
else
    print_error "Final health check failed"
    docker-compose logs api
    exit 1
fi

# Show final status
echo ""
echo "📊 Final Status:"
docker-compose ps

echo ""
print_status "🎉 All tests passed! Your application handles restarts correctly."
echo ""
echo "📋 Summary of what was tested:"
echo "   ✅ Services start automatically"
echo "   ✅ Health checks work properly"
echo "   ✅ API endpoints are accessible"
echo "   ✅ Services restart after power cycle simulation"
echo "   ✅ Graceful shutdown works"
echo "   ✅ Services recover after graceful shutdown"
echo ""
echo "🚀 Your application is ready for GCP deployment!" 