#!/bin/bash

# k6 Performance Test Runner for E-commerce API Hackathon
# This script provides easy ways to run performance tests with different configurations

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default configuration
DEFAULT_BASE_URL="http://localhost:3000"
DEFAULT_OUTPUT_FORMAT="text"
DEFAULT_VERBOSE="false"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to show usage
show_usage() {
    echo "k6 Performance Test Runner"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -u, --url URL           Base URL of your API (default: $DEFAULT_BASE_URL)"
    echo "  -o, --output FORMAT     Output format: text, json, influxdb (default: $DEFAULT_OUTPUT_FORMAT)"
    echo "  -v, --verbose           Enable verbose output"
    echo "  -q, --quick             Run quick test (5 minutes, 100 users)"
    echo "  -f, --full              Run full test (25 minutes, 1000 users)"
    echo "  -s, --spike             Run spike test only"
    echo "  -w, --warmup            Run warmup test only"
    echo "  -h, --help              Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run full test against localhost:3000"
    echo "  $0 -u http://my-api.com:8080         # Run against specific URL"
    echo "  $0 -q -v                             # Quick test with verbose output"
    echo "  $0 -o json -f                        # Full test with JSON output"
    echo ""
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check if k6 is installed
    if ! command -v k6 &> /dev/null; then
        print_error "k6 is not installed. Please install k6 first:"
        echo "  https://k6.io/docs/getting-started/installation/"
        exit 1
    fi
    
    # Check if the test script exists
    if [ ! -f "k6-performance-test.js" ]; then
        print_error "k6-performance-test.js not found in current directory"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Function to check API health
check_api_health() {
    local base_url=$1
    print_status "Checking API health at $base_url..."
    
    if curl -s -f "$base_url/health" > /dev/null; then
        print_success "API is healthy"
    else
        print_warning "API health check failed. Make sure your API is running."
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Function to run quick test
run_quick_test() {
    local base_url=$1
    local output_format=$2
    local verbose=$3
    
    print_status "Running quick performance test (5 minutes, 100 users)..."
    
    local cmd="k6 run"
    
    if [ "$verbose" = "true" ]; then
        cmd="$cmd --verbose"
    fi
    
    case $output_format in
        "json")
            cmd="$cmd --out json=quick-test-results.json"
            ;;
        "influxdb")
            cmd="$cmd --out influxdb=http://localhost:8086/k6"
            ;;
    esac
    
    cmd="$cmd -e BASE_URL=$base_url k6-performance-test.js"
    
    # Override test duration for quick test
    cmd="$cmd --stage 30s:10 --stage 1m:50 --stage 2m:100 --stage 1m:0"
    
    echo "Executing: $cmd"
    eval $cmd
}

# Function to run full test
run_full_test() {
    local base_url=$1
    local output_format=$2
    local verbose=$3
    
    print_status "Running full performance test (25 minutes, 1000 users)..."
    
    local cmd="k6 run"
    
    if [ "$verbose" = "true" ]; then
        cmd="$cmd --verbose"
    fi
    
    case $output_format in
        "json")
            cmd="$cmd --out json=full-test-results.json"
            ;;
        "influxdb")
            cmd="$cmd --out influxdb=http://localhost:8086/k6"
            ;;
    esac
    
    cmd="$cmd -e BASE_URL=$base_url k6-performance-test.js"
    
    echo "Executing: $cmd"
    eval $cmd
}

# Function to run spike test
run_spike_test() {
    local base_url=$1
    local output_format=$2
    local verbose=$3
    
    print_status "Running spike test (2 minutes)..."
    
    local cmd="k6 run"
    
    if [ "$verbose" = "true" ]; then
        cmd="$cmd --verbose"
    fi
    
    case $output_format in
        "json")
            cmd="$cmd --out json=spike-test-results.json"
            ;;
        "influxdb")
            cmd="$cmd --out influxdb=http://localhost:8086/k6"
            ;;
    esac
    
    cmd="$cmd -e BASE_URL=$base_url --exec spikeTest k6-performance-test.js"
    
    echo "Executing: $cmd"
    eval $cmd
}

# Function to run warmup test
run_warmup_test() {
    local base_url=$1
    local output_format=$2
    local verbose=$3
    
    print_status "Running warmup test (1 minute)..."
    
    local cmd="k6 run"
    
    if [ "$verbose" = "true" ]; then
        cmd="$cmd --verbose"
    fi
    
    case $output_format in
        "json")
            cmd="$cmd --out json=warmup-test-results.json"
            ;;
        "influxdb")
            cmd="$cmd --out influxdb=http://localhost:8086/k6"
            ;;
    esac
    
    cmd="$cmd -e BASE_URL=$base_url --exec warmup k6-performance-test.js"
    
    echo "Executing: $cmd"
    eval $cmd
}

# Parse command line arguments
BASE_URL=$DEFAULT_BASE_URL
OUTPUT_FORMAT=$DEFAULT_OUTPUT_FORMAT
VERBOSE=$DEFAULT_VERBOSE
TEST_TYPE="full"

while [[ $# -gt 0 ]]; do
    case $1 in
        -u|--url)
            BASE_URL="$2"
            shift 2
            ;;
        -o|--output)
            OUTPUT_FORMAT="$2"
            shift 2
            ;;
        -v|--verbose)
            VERBOSE="true"
            shift
            ;;
        -q|--quick)
            TEST_TYPE="quick"
            shift
            ;;
        -f|--full)
            TEST_TYPE="full"
            shift
            ;;
        -s|--spike)
            TEST_TYPE="spike"
            shift
            ;;
        -w|--warmup)
            TEST_TYPE="warmup"
            shift
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Main execution
main() {
    echo "🚀 k6 Performance Test Runner for E-commerce API"
    echo "================================================"
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Check API health
    check_api_health "$BASE_URL"
    
    echo ""
    print_status "Configuration:"
    echo "  Base URL: $BASE_URL"
    echo "  Output Format: $OUTPUT_FORMAT"
    echo "  Verbose: $VERBOSE"
    echo "  Test Type: $TEST_TYPE"
    echo ""
    
    # Run appropriate test
    case $TEST_TYPE in
        "quick")
            run_quick_test "$BASE_URL" "$OUTPUT_FORMAT" "$VERBOSE"
            ;;
        "full")
            run_full_test "$BASE_URL" "$OUTPUT_FORMAT" "$VERBOSE"
            ;;
        "spike")
            run_spike_test "$BASE_URL" "$OUTPUT_FORMAT" "$VERBOSE"
            ;;
        "warmup")
            run_warmup_test "$BASE_URL" "$OUTPUT_FORMAT" "$VERBOSE"
            ;;
        *)
            print_error "Unknown test type: $TEST_TYPE"
            exit 1
            ;;
    esac
    
    echo ""
    print_success "Performance test completed!"
    echo ""
    print_status "Next steps:"
    echo "  1. Review the test results above"
    echo "  2. Check if all thresholds were met"
    echo "  3. Analyze any performance issues"
    echo "  4. Optimize your application if needed"
    echo "  5. Run the test again to verify improvements"
    echo ""
    print_status "For detailed analysis, check the README-k6-testing.md file"
}

# Run main function
main 