#!/usr/bin/env node

/**
 * Performance Monitoring Script
 * 
 * Monitors system resources and application metrics during load testing
 * Run this script alongside your k6 load test to get real-time insights
 * 
 * Usage: node monitor-performance.js [options]
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

class PerformanceMonitor {
  constructor(options = {}) {
    this.interval = options.interval || 5000; // 5 seconds
    this.duration = options.duration || 30 * 60 * 1000; // 30 minutes
    this.outputFile = options.outputFile || 'performance-metrics.json';
    this.metrics = [];
    this.isRunning = false;
  }

  async getSystemMetrics() {
    const timestamp = new Date().toISOString();
    const metrics = { timestamp };

    try {
      // CPU Usage
      const cpuResult = await execAsync('top -bn1 | grep "Cpu(s)" | awk \'{print $2}\' | cut -d"%" -f1');
      metrics.cpu = parseFloat(cpuResult.stdout.trim());

      // Memory Usage
      const memResult = await execAsync('free -m | grep Mem | awk \'{print $3"/"$2" MB"}\'');
      const [used, total] = memResult.stdout.trim().split('/');
      metrics.memory = {
        used: parseInt(used),
        total: parseInt(total),
        percentage: Math.round((parseInt(used) / parseInt(total)) * 100)
      };

      // Disk I/O
      const diskResult = await execAsync('iostat -x 1 1 | tail -n 2 | head -n 1');
      const diskParts = diskResult.stdout.trim().split(/\s+/);
      metrics.disk = {
        read: parseFloat(diskParts[2]) || 0,
        write: parseFloat(diskParts[3]) || 0
      };

      // Network I/O
      const netResult = await execAsync('cat /proc/net/dev | grep eth0 | awk \'{print $2" "$10}\'');
      const [bytesIn, bytesOut] = netResult.stdout.trim().split(' ');
      metrics.network = {
        bytesIn: parseInt(bytesIn),
        bytesOut: parseInt(bytesOut)
      };

      // Process Count
      const processResult = await execAsync('ps aux | wc -l');
      metrics.processes = parseInt(processResult.stdout.trim());

      // Node.js Process Memory
      const nodeResult = await execAsync('ps -o pid,rss,vsz,comm -p $(pgrep -f "node.*server.js")');
      if (nodeResult.stdout.includes('node')) {
        const nodeParts = nodeResult.stdout.trim().split(/\s+/);
        metrics.nodeProcess = {
          rss: parseInt(nodeParts[1]) || 0, // Resident Set Size in KB
          vsz: parseInt(nodeParts[2]) || 0  // Virtual Memory Size in KB
        };
      }

    } catch (error) {
      console.warn('Error getting system metrics:', error.message);
    }

    return metrics;
  }

  async getApplicationMetrics() {
    const timestamp = new Date().toISOString();
    const metrics = { timestamp, type: 'application' };

    try {
      // Health check
      const healthResponse = await fetch('http://localhost:3000/health');
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        metrics.health = healthData;
      }

      // Test API endpoints
      const endpoints = [
        '/api/products?page=1&limit=10',
        '/api/products/1',
        '/api/products/search?search=laptop&page=1&limit=10',
        '/api/products/latest?limit=8'
      ];

      const endpointMetrics = [];
      for (const endpoint of endpoints) {
        const startTime = Date.now();
        try {
          const response = await fetch(`http://localhost:3000${endpoint}`);
          const endTime = Date.now();
          
          endpointMetrics.push({
            endpoint,
            status: response.status,
            responseTime: endTime - startTime,
            cacheHit: response.headers.get('X-Cache') === 'HIT',
            queuePosition: response.headers.get('X-Queue-Position'),
            queueWaitTime: response.headers.get('X-Queue-Wait-Time')
          });
        } catch (error) {
          endpointMetrics.push({
            endpoint,
            error: error.message,
            responseTime: Date.now() - startTime
          });
        }
      }

      metrics.endpoints = endpointMetrics;

    } catch (error) {
      console.warn('Error getting application metrics:', error.message);
    }

    return metrics;
  }

  async collectMetrics() {
    const systemMetrics = await this.getSystemMetrics();
    const appMetrics = await this.getApplicationMetrics();
    
    const combinedMetrics = {
      ...systemMetrics,
      application: appMetrics
    };

    this.metrics.push(combinedMetrics);
    
    // Log current metrics
    console.log(`[${new Date().toLocaleTimeString()}] CPU: ${systemMetrics.cpu}% | Memory: ${systemMetrics.memory?.percentage}% | Processes: ${systemMetrics.processes}`);
    
    if (appMetrics.endpoints) {
      const avgResponseTime = appMetrics.endpoints.reduce((sum, ep) => sum + (ep.responseTime || 0), 0) / appMetrics.endpoints.length;
      console.log(`  API Avg Response Time: ${avgResponseTime.toFixed(2)}ms`);
    }
  }

  async start() {
    console.log('🚀 Starting Performance Monitor...');
    console.log(`📊 Monitoring interval: ${this.interval}ms`);
    console.log(`⏱️ Duration: ${this.duration / 1000 / 60} minutes`);
    console.log(`💾 Output file: ${this.outputFile}`);
    console.log('');

    this.isRunning = true;
    const startTime = Date.now();

    const intervalId = setInterval(async () => {
      if (!this.isRunning || Date.now() - startTime > this.duration) {
        this.stop();
        return;
      }

      await this.collectMetrics();
    }, this.interval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Received SIGINT, stopping monitor...');
      this.stop();
    });

    process.on('SIGTERM', () => {
      console.log('\n🛑 Received SIGTERM, stopping monitor...');
      this.stop();
    });
  }

  stop() {
    this.isRunning = false;
    
    // Save metrics to file
    const outputPath = path.resolve(this.outputFile);
    fs.writeFileSync(outputPath, JSON.stringify(this.metrics, null, 2));
    
    console.log(`\n✅ Performance monitoring completed!`);
    console.log(`📁 Metrics saved to: ${outputPath}`);
    console.log(`📊 Total data points: ${this.metrics.length}`);
    
    // Print summary
    if (this.metrics.length > 0) {
      const cpuValues = this.metrics.map(m => m.cpu).filter(c => c !== undefined);
      const memoryValues = this.metrics.map(m => m.memory?.percentage).filter(m => m !== undefined);
      
      if (cpuValues.length > 0) {
        console.log(`🔥 CPU Usage - Avg: ${(cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length).toFixed(1)}% | Max: ${Math.max(...cpuValues).toFixed(1)}%`);
      }
      
      if (memoryValues.length > 0) {
        console.log(`💾 Memory Usage - Avg: ${(memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length).toFixed(1)}% | Max: ${Math.max(...memoryValues).toFixed(1)}%`);
      }
    }
    
    process.exit(0);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {};

for (let i = 0; i < args.length; i++) {
  switch (args[i]) {
    case '--interval':
    case '-i':
      options.interval = parseInt(args[++i]) * 1000;
      break;
    case '--duration':
    case '-d':
      options.duration = parseInt(args[++i]) * 60 * 1000;
      break;
    case '--output':
    case '-o':
      options.outputFile = args[++i];
      break;
    case '--help':
    case '-h':
      console.log(`
Performance Monitor Usage:
  node monitor-performance.js [options]

Options:
  -i, --interval <seconds>    Monitoring interval in seconds (default: 5)
  -d, --duration <minutes>    Monitoring duration in minutes (default: 30)
  -o, --output <file>         Output file path (default: performance-metrics.json)
  -h, --help                  Show this help message

Examples:
  node monitor-performance.js
  node monitor-performance.js -i 10 -d 60
  node monitor-performance.js --output my-metrics.json
      `);
      process.exit(0);
  }
}

// Start monitoring
const monitor = new PerformanceMonitor(options);
monitor.start(); 