# k6 Performance Test Runner for E-commerce API Hackathon (PowerShell Version)
# This script provides easy ways to run performance tests with different configurations

param(
    [string]$Url = "http://localhost:3000",
    [string]$OutputFormat = "text",
    [switch]$Verbose,
    [switch]$Quick,
    [switch]$Full,
    [switch]$Spike,
    [switch]$Warmup,
    [switch]$Help
)

# Function to print colored output
function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Function to show usage
function Show-Usage {
    Write-Host "k6 Performance Test Runner (PowerShell)" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage: .\run-performance-test.ps1 [OPTIONS]"
    Write-Host ""
    Write-Host "Options:"
    Write-Host "  -Url URL                    Base URL of your API (default: http://localhost:3000)"
    Write-Host "  -OutputFormat FORMAT        Output format: text, json, influxdb (default: text)"
    Write-Host "  -Verbose                    Enable verbose output"
    Write-Host "  -Quick                      Run quick test (5 minutes, 100 users)"
    Write-Host "  -Full                       Run full test (25 minutes, 1000 users)"
    Write-Host "  -Spike                      Run spike test only"
    Write-Host "  -Warmup                     Run warmup test only"
    Write-Host "  -Help                       Show this help message"
    Write-Host ""
    Write-Host "Examples:"
    Write-Host "  .\run-performance-test.ps1                                    # Run full test against localhost:3000"
    Write-Host "  .\run-performance-test.ps1 -Url http://my-api.com:8080       # Run against specific URL"
    Write-Host "  .\run-performance-test.ps1 -Quick -Verbose                   # Quick test with verbose output"
    Write-Host "  .\run-performance-test.ps1 -OutputFormat json -Full          # Full test with JSON output"
    Write-Host ""
}

# Function to check prerequisites
function Test-Prerequisites {
    Write-Status "Checking prerequisites..."
    
    # Check if k6 is installed
    try {
        $null = Get-Command k6 -ErrorAction Stop
    }
    catch {
        Write-Error "k6 is not installed. Please install k6 first:"
        Write-Host "  https://k6.io/docs/getting-started/installation/"
        exit 1
    }
    
    # Check if the test script exists
    if (-not (Test-Path "k6-performance-test.js")) {
        Write-Error "k6-performance-test.js not found in current directory"
        exit 1
    }
    
    Write-Success "Prerequisites check passed"
}

# Function to check API health
function Test-ApiHealth {
    param([string]$BaseUrl)
    
    Write-Status "Checking API health at $BaseUrl..."
    
    try {
        $response = Invoke-WebRequest -Uri "$BaseUrl/health" -Method GET -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Write-Success "API is healthy"
        }
        else {
            throw "API returned status code $($response.StatusCode)"
        }
    }
    catch {
        Write-Warning "API health check failed. Make sure your API is running."
        $continue = Read-Host "Continue anyway? (y/N)"
        if ($continue -ne "y" -and $continue -ne "Y") {
            exit 1
        }
    }
}

# Function to run quick test
function Start-QuickTest {
    param([string]$BaseUrl, [string]$OutputFormat, [bool]$Verbose)
    
    Write-Status "Running quick performance test (5 minutes, 100 users)..."
    
    $cmd = "k6 run"
    
    if ($Verbose) {
        $cmd += " --verbose"
    }
    
    switch ($OutputFormat) {
        "json" { $cmd += " --out json=quick-test-results.json" }
        "influxdb" { $cmd += " --out influxdb=http://localhost:8086/k6" }
    }
    
    $cmd += " -e BASE_URL=$BaseUrl k6-performance-test.js"
    $cmd += " --stage 30s:10 --stage 1m:50 --stage 2m:100 --stage 1m:0"
    
    Write-Host "Executing: $cmd"
    Invoke-Expression $cmd
}

# Function to run full test
function Start-FullTest {
    param([string]$BaseUrl, [string]$OutputFormat, [bool]$Verbose)
    
    Write-Status "Running full performance test (25 minutes, 1000 users)..."
    
    $cmd = "k6 run"
    
    if ($Verbose) {
        $cmd += " --verbose"
    }
    
    switch ($OutputFormat) {
        "json" { $cmd += " --out json=full-test-results.json" }
        "influxdb" { $cmd += " --out influxdb=http://localhost:8086/k6" }
    }
    
    $cmd += " -e BASE_URL=$BaseUrl k6-performance-test.js"
    
    Write-Host "Executing: $cmd"
    Invoke-Expression $cmd
}

# Function to run spike test
function Start-SpikeTest {
    param([string]$BaseUrl, [string]$OutputFormat, [bool]$Verbose)
    
    Write-Status "Running spike test (2 minutes)..."
    
    $cmd = "k6 run"
    
    if ($Verbose) {
        $cmd += " --verbose"
    }
    
    switch ($OutputFormat) {
        "json" { $cmd += " --out json=spike-test-results.json" }
        "influxdb" { $cmd += " --out influxdb=http://localhost:8086/k6" }
    }
    
    $cmd += " -e BASE_URL=$BaseUrl --exec spikeTest k6-performance-test.js"
    
    Write-Host "Executing: $cmd"
    Invoke-Expression $cmd
}

# Function to run warmup test
function Start-WarmupTest {
    param([string]$BaseUrl, [string]$OutputFormat, [bool]$Verbose)
    
    Write-Status "Running warmup test (1 minute)..."
    
    $cmd = "k6 run"
    
    if ($Verbose) {
        $cmd += " --verbose"
    }
    
    switch ($OutputFormat) {
        "json" { $cmd += " --out json=warmup-test-results.json" }
        "influxdb" { $cmd += " --out influxdb=http://localhost:8086/k6" }
    }
    
    $cmd += " -e BASE_URL=$BaseUrl --exec warmup k6-performance-test.js"
    
    Write-Host "Executing: $cmd"
    Invoke-Expression $cmd
}

# Main execution
function Main {
    Write-Host "🚀 k6 Performance Test Runner for E-commerce API" -ForegroundColor Cyan
    Write-Host "================================================" -ForegroundColor Cyan
    Write-Host ""
    
    # Show help if requested
    if ($Help) {
        Show-Usage
        return
    }
    
    # Determine test type
    $testType = "full"
    if ($Quick) { $testType = "quick" }
    elseif ($Spike) { $testType = "spike" }
    elseif ($Warmup) { $testType = "warmup" }
    
    # Check prerequisites
    Test-Prerequisites
    
    # Check API health
    Test-ApiHealth $Url
    
    Write-Host ""
    Write-Status "Configuration:"
    Write-Host "  Base URL: $Url"
    Write-Host "  Output Format: $OutputFormat"
    Write-Host "  Verbose: $Verbose"
    Write-Host "  Test Type: $testType"
    Write-Host ""
    
    # Run appropriate test
    switch ($testType) {
        "quick" { Start-QuickTest $Url $OutputFormat $Verbose }
        "full" { Start-FullTest $Url $OutputFormat $Verbose }
        "spike" { Start-SpikeTest $Url $OutputFormat $Verbose }
        "warmup" { Start-WarmupTest $Url $OutputFormat $Verbose }
        default { Write-Error "Unknown test type: $testType"; exit 1 }
    }
    
    Write-Host ""
    Write-Success "Performance test completed!"
    Write-Host ""
    Write-Status "Next steps:"
    Write-Host "  1. Review the test results above"
    Write-Host "  2. Check if all thresholds were met"
    Write-Host "  3. Analyze any performance issues"
    Write-Host "  4. Optimize your application if needed"
    Write-Host "  5. Run the test again to verify improvements"
    Write-Host ""
    Write-Status "For detailed analysis, check the README-k6-testing.md file"
}

# Run main function
Main 