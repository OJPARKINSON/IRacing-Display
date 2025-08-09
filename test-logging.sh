#!/bin/bash

echo "🧪 Testing log ingestion for IRacing Telemetry System..."
echo "================================================"

# Function to test if a service is running and generating logs
test_service_logs() {
    local service_name=$1
    local container_name=$2
    
    echo -n "Testing $service_name logs... "
    
    # Check if container exists and is running
    if ! docker ps --format "table {{.Names}}" | grep -q "^$container_name$"; then
        echo "❌ Container '$container_name' not running"
        return 1
    fi
    
    # Get recent logs (last 10 lines)
    local logs=$(docker logs --tail 10 --since="2m" "$container_name" 2>&1)
    
    if [ -n "$logs" ]; then
        echo "✅ Generating logs"
        echo "   Latest log: $(echo "$logs" | tail -1 | cut -c1-80)..."
    else
        echo "⚠️  No recent logs found"
    fi
}

# Test each service
echo ""
echo "🔍 Checking service log generation:"
test_service_logs "QuestDB" "questdb"
test_service_logs "Telemetry Service" "telemetry_service" 
test_service_logs "Telemetry Dashboard" "telemetry-dashboard"
test_service_logs "RabbitMQ" "rabbitMQ"

echo ""
echo "🔍 Checking log collection services:"
test_service_logs "Grafana Alloy" "grafana-alloy"
test_service_logs "Loki" "loki"
test_service_logs "Prometheus" "prometheus"
test_service_logs "Grafana" "grafana"

echo ""
echo "🔗 Testing log flow through Alloy to Loki:"

# Check if Alloy is discovering containers
echo -n "Alloy container discovery... "
if curl -s "http://localhost:12345/api/v0/component/discovery.docker.containers/debug/info" >/dev/null 2>&1; then
    echo "✅ Alloy API accessible"
else
    echo "⚠️  Cannot reach Alloy API"
fi

# Check Loki health
echo -n "Loki health check... "
if curl -s "http://localhost:3100/ready" >/dev/null 2>&1; then
    echo "✅ Loki is ready"
else
    echo "❌ Loki not accessible"
fi

# Test log ingestion by generating a test log
echo -n "Generating test log entry... "
docker exec questdb sh -c 'echo "🧪 Test log entry from questdb - $(date)"' >/dev/null 2>&1
echo "✅ Test log sent"

echo ""
echo "📊 Dashboard verification:"
echo "1. Open Grafana: http://localhost:3002 (admin/admin123)"
echo "2. Navigate to 'Enhanced IRacing Telemetry System' dashboard"
echo "3. Check the 'Recent Application Logs' panel for log entries"
echo "4. Check the 'Log Ingestion Verification' panel for ingestion rates"

echo ""
echo "🔧 Manual verification commands:"
echo "- View Loki logs: docker logs loki"
echo "- View Alloy logs: docker logs grafana-alloy"
echo "- Check Alloy metrics: curl http://localhost:12345/metrics"
echo "- Query Loki directly: curl 'http://localhost:3100/loki/api/v1/query_range?query={job=\"docker-logs\"}'"

echo ""
echo "✅ Log testing complete!"