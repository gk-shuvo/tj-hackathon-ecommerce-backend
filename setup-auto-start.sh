#!/bin/bash

# Setup script for automatic Docker Compose startup on boot

echo "Setting up automatic Docker Compose startup..."

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo "Please run this script as root (use sudo)"
    exit 1
fi

# Get the current directory (where the repository is cloned)
CURRENT_DIR=$(pwd)

echo "Detected working directory: $CURRENT_DIR"

# Check if docker-compose.yml exists in current directory
if [ ! -f "$CURRENT_DIR/docker-compose.yml" ]; then
    echo "ERROR: docker-compose.yml not found in current directory"
    echo "Please run this script from the directory containing docker-compose.yml"
    exit 1
fi

# Check if docker-compose.service exists
if [ ! -f "$CURRENT_DIR/docker-compose.service" ]; then
    echo "ERROR: docker-compose.service not found in current directory"
    echo "Please make sure all files are present in the repository"
    exit 1
fi

# Create a temporary service file with the correct path
TEMP_SERVICE_FILE="/tmp/docker-compose-app.service"

# Create the service file with the correct working directory
cat > "$TEMP_SERVICE_FILE" << EOF
[Unit]
Description=Docker Compose Application
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$CURRENT_DIR
ExecStart=/usr/local/bin/docker-compose up -d
ExecStop=/usr/local/bin/docker-compose down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF

echo "Created service file with working directory: $CURRENT_DIR"

# Copy the service file to systemd directory
cp "$TEMP_SERVICE_FILE" /etc/systemd/system/docker-compose-app.service

# Clean up temporary file
rm "$TEMP_SERVICE_FILE"

# Reload systemd to recognize the new service
systemctl daemon-reload

# Enable the service to start on boot
systemctl enable docker-compose-app.service

echo "Service installed and enabled!"
echo "Working directory set to: $CURRENT_DIR"
echo ""
echo "To start the service now, run: sudo systemctl start docker-compose-app.service"
echo "To check status, run: sudo systemctl status docker-compose-app.service"
echo "To view logs, run: sudo journalctl -u docker-compose-app.service -f"
echo ""
echo "IMPORTANT: Make sure to run this script from the directory containing docker-compose.yml" 