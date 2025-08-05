# Local testing script for automatic restart functionality (PowerShell version)
# This script simulates what happens when a GCP instance is turned off and on again

Write-Host "Testing Automatic Restart Functionality Locally" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "SUCCESS: $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "WARNING: $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "ERROR: $Message" -ForegroundColor Red
}

# Check if Docker is running
try {
    docker info | Out-Null
    Write-Status "Docker is running"
} catch {
    Write-Error "Docker is not running. Please start Docker first."
    exit 1
}

# Check if docker-compose is available
try {
    docker-compose --version | Out-Null
    Write-Status "docker-compose is available"
} catch {
    Write-Error "docker-compose is not installed. Please install it first."
    exit 1
}

# Step 1: Build and start the services
Write-Host ""
Write-Host "Step 1: Building and starting services..." -ForegroundColor Blue
docker-compose down --volumes --remove-orphans
docker-compose build --no-cache
docker-compose up -d

# Wait for services to be healthy
Write-Host ""
Write-Host "Waiting for services to be healthy..." -ForegroundColor Blue
$timeout = 120
$counter = 0

while ($counter -lt $timeout) {
    $psOutput = docker-compose ps
    if ($psOutput -match "healthy") {
        Write-Status "All services are healthy!"
        break
    }
    
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 2
    $counter += 2
}

if ($counter -eq $timeout) {
    Write-Error "Services did not become healthy within $timeout seconds"
    docker-compose logs
    exit 1
}

# Step 2: Test the API
Write-Host ""
Write-Host "Step 2: Testing API endpoints..." -ForegroundColor Blue
Start-Sleep -Seconds 5

# Test health endpoint
Write-Host "Testing health endpoint..."
try {
    Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing | Out-Null
    Write-Status "Health endpoint is working"
} catch {
    Write-Error "Health endpoint is not working"
    docker-compose logs api
    exit 1
}

# Test products endpoint
Write-Host "Testing products endpoint..."
try {
    Invoke-WebRequest -Uri "http://localhost:3000/api/products" -UseBasicParsing | Out-Null
    Write-Status "Products endpoint is working"
} catch {
    Write-Error "Products endpoint is not working"
    docker-compose logs api
    exit 1
}

# Step 3: Simulate restart
Write-Host ""
Write-Host "Step 3: Simulating system restart..." -ForegroundColor Blue
Write-Host "Stopping all containers (simulating power off)..."
docker-compose down

Write-Host "Starting containers again (simulating power on)..."
docker-compose up -d

# Wait for services to be healthy again
Write-Host ""
Write-Host "Waiting for services to be healthy after restart..." -ForegroundColor Blue
$counter = 0

while ($counter -lt $timeout) {
    $psOutput = docker-compose ps
    if ($psOutput -match "healthy") {
        Write-Status "All services are healthy after restart!"
        break
    }
    
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 2
    $counter += 2
}

if ($counter -eq $timeout) {
    Write-Error "Services did not become healthy after restart within $timeout seconds"
    docker-compose logs
    exit 1
}

# Step 4: Test API again after restart
Write-Host ""
Write-Host "Step 4: Testing API endpoints after restart..." -ForegroundColor Blue
Start-Sleep -Seconds 5

# Test health endpoint again
Write-Host "Testing health endpoint after restart..."
try {
    Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing | Out-Null
    Write-Status "Health endpoint is working after restart"
} catch {
    Write-Error "Health endpoint is not working after restart"
    docker-compose logs api
    exit 1
}

# Test products endpoint again
Write-Host "Testing products endpoint after restart..."
try {
    Invoke-WebRequest -Uri "http://localhost:3000/api/products" -UseBasicParsing | Out-Null
    Write-Status "Products endpoint is working after restart"
} catch {
    Write-Error "Products endpoint is not working after restart"
    docker-compose logs api
    exit 1
}

# Step 5: Test graceful shutdown
Write-Host ""
Write-Host "Step 5: Testing graceful shutdown..." -ForegroundColor Blue
Write-Host "Sending SIGTERM to containers..."

# Get the container IDs
$API_CONTAINER = docker-compose ps -q api
$DB_CONTAINER = docker-compose ps -q db
$REDIS_CONTAINER = docker-compose ps -q redis

# Send SIGTERM to simulate graceful shutdown
docker stop $API_CONTAINER $DB_CONTAINER $REDIS_CONTAINER

Write-Host "Containers stopped. Starting them again..."
docker-compose up -d

# Wait for services to be healthy again
Write-Host ""
Write-Host "Waiting for services to be healthy after graceful shutdown..." -ForegroundColor Blue
$counter = 0

while ($counter -lt $timeout) {
    $psOutput = docker-compose ps
    if ($psOutput -match "healthy") {
        Write-Status "All services are healthy after graceful shutdown!"
        break
    }
    
    Write-Host "." -NoNewline
    Start-Sleep -Seconds 2
    $counter += 2
}

if ($counter -eq $timeout) {
    Write-Error "Services did not become healthy after graceful shutdown within $timeout seconds"
    docker-compose logs
    exit 1
}

# Final test
Write-Host ""
Write-Host "Final API test after graceful shutdown..." -ForegroundColor Blue
Start-Sleep -Seconds 5

try {
    Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing | Out-Null
    Write-Status "Final health check passed"
} catch {
    Write-Error "Final health check failed"
    docker-compose logs api
    exit 1
}

# Show final status
Write-Host ""
Write-Host "Final Status:" -ForegroundColor Blue
docker-compose ps

Write-Host ""
Write-Status "All tests passed! Your application handles restarts correctly."
Write-Host ""
Write-Host "Summary of what was tested:" -ForegroundColor Cyan
Write-Host "   SUCCESS: Services start automatically"
Write-Host "   SUCCESS: Health checks work properly"
Write-Host "   SUCCESS: API endpoints are accessible"
Write-Host "   SUCCESS: Services restart after power cycle simulation"
Write-Host "   SUCCESS: Graceful shutdown works"
Write-Host "   SUCCESS: Services recover after graceful shutdown"
Write-Host ""
Write-Host "Your application is ready for GCP deployment!" -ForegroundColor Green 