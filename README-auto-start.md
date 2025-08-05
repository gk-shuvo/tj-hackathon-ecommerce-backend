# Automatic Startup Configuration for GCP

This document explains how to configure automatic startup for your application when a GCP instance is turned off and on again.

## Changes Made

### 1. Docker Compose Updates (`docker-compose.yml`)
- Added `restart: always` to the API service
- Added health checks for all services (API, PostgreSQL, Redis)
- Updated service dependencies to wait for healthy services

### 2. Dockerfile Updates (`Dockerfile`)
- Added `tini` for proper signal handling
- Added `wget` for health checks
- Updated entrypoint to use `tini`

### 3. Systemd Service (`docker-compose.service`)
- Created a systemd service file for automatic startup
- Service will start Docker Compose on boot

### 4. Setup Script (`setup-auto-start.sh`)
- Automated installation script for the systemd service
- **Automatically detects the correct working directory**
- Creates the service file with the proper path

## Setup Instructions

### On Your GCP Instance:

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd hackathon-project-backend
   ```

2. **Make the setup script executable**:
   ```bash
   chmod +x setup-auto-start.sh
   ```

3. **Run the setup script as root** (this will automatically set the correct path):
   ```bash
   sudo ./setup-auto-start.sh
   ```

4. **Build and start the services**:
   ```bash
   docker-compose build --no-cache
   docker-compose up -d
   ```

5. **Start the systemd service**:
   ```bash
   sudo systemctl start docker-compose-app.service
   ```

6. **Verify it's working**:
   ```bash
   sudo systemctl status docker-compose-app.service
   ```

## How the Setup Script Works

The setup script automatically:

1. **Detects the current directory** where you cloned the repository
2. **Validates required files** exist (docker-compose.yml, etc.)
3. **Creates a systemd service file** with the correct working directory
4. **Installs and enables the service** for automatic startup

**Example output:**
```
Setting up automatic Docker Compose startup...
Detected working directory: /home/user/hackathon-project-backend
Created service file with working directory: /home/user/hackathon-project-backend
Service installed and enabled!
Working directory set to: /home/user/hackathon-project-backend
```

## What Happens Now

When your GCP instance is turned off and on again:

1. **System boots up**
2. **Docker service starts**
3. **Our systemd service starts automatically**
4. **Docker Compose starts all services**
5. **Health checks ensure services are ready**
6. **API waits for database and Redis to be healthy**

## Monitoring

- **Check service status**: `sudo systemctl status docker-compose-app.service`
- **View logs**: `sudo journalctl -u docker-compose-app.service -f`
- **Check Docker containers**: `docker-compose ps`

## Troubleshooting

If services don't start automatically:

1. **Check if the service is enabled**:
   ```bash
   sudo systemctl is-enabled docker-compose-app.service
   ```

2. **Check Docker service**:
   ```bash
   sudo systemctl status docker
   ```

3. **Check the working directory**:
   ```bash
   sudo systemctl show docker-compose-app.service | grep WorkingDirectory
   ```

4. **Manual start**:
   ```bash
   sudo systemctl start docker-compose-app.service
   ```

## Health Check Endpoints

The application includes health check endpoints:
- **API Health**: `http://localhost:3000/health`
- **Database**: PostgreSQL health check via `pg_isready`
- **Redis**: Redis health check via `redis-cli ping`

## Important Notes

- **Run setup script from the repository directory** containing `docker-compose.yml`
- **The script automatically detects the correct path** - no manual editing needed
- **All services will restart automatically** when the GCP instance reboots
- **Health checks ensure proper startup order** and service readiness

All services will now restart automatically when the GCP instance reboots! 