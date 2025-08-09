#!/bin/bash

echo "🔍 Debugging Metrics Availability"
echo "================================"

# Function to test endpoint availability
test_endpoint() {
    local service=$1
    local url=$2
    local description=$3
    
    echo -n "Testing $service ($description)... "
    
    if curl -s --max-time 5 "$url" >/dev/null 2>&1; then
        echo "✅ Accessible"
        return 0
    else
        echo "❌ Not accessible"
        return 1
    fi
}

# Function to show available metrics
show_metrics() {
    local service=$1
    local url=$2
    
    echo ""
    echo "📊 Available metrics from $service:"
    echo "-----------------------------------"
    
    local metrics=$(curl -s --max-time 10 "$url" 2>/dev/null)
    if [ $? -eq 0 ] && [ -n "$metrics" ]; then
        # Show first 20 metric names (lines that don't start with #)
        echo "$metrics" | grep -v '^#' | grep -v '^$' | head -20
        echo ""
        local count=$(echo "$metrics" | grep -v '^#' | grep -v '^$' | wc -l)
        echo "Total metrics available: $count"
    else
        echo "❌ No metrics data available"
    fi
}

echo ""
echo "🌐 Testing Service Endpoints:"

# Test all endpoints
test_endpoint "QuestDB Web" "http://localhost:9000" "Web Console"
questdb_web=$?

test_endpoint "QuestDB Metrics" "http://localhost:9003/metrics" "Prometheus Metrics"
questdb_metrics=$?

test_endpoint "Telemetry Service API" "http://localhost:5000" "API Health"
telemetry_api=$?

test_endpoint "Telemetry Service Metrics" "http://localhost:5000/metrics" "Prometheus Metrics"  
telemetry_metrics=$?

test_endpoint "RabbitMQ Management" "http://localhost:15672" "Management UI"
rabbitmq_mgmt=$?

test_endpoint "RabbitMQ Metrics" "http://localhost:15692/metrics" "Prometheus Metrics"
rabbitmq_metrics=$?

test_endpoint "Prometheus" "http://localhost:9090" "Prometheus UI"
prometheus=$?

# Show available metrics for accessible endpoints
if [ $questdb_metrics -eq 0 ]; then
    show_metrics "QuestDB" "http://localhost:9003/metrics"
fi

if [ $telemetry_metrics -eq 0 ]; then
    show_metrics "Telemetry Service" "http://localhost:5000/metrics"
fi

if [ $rabbitmq_metrics -eq 0 ]; then
    show_metrics "RabbitMQ" "http://localhost:15692/metrics"
fi

echo ""
echo "🔍 Checking Prometheus Targets:"
echo "------------------------------"

if [ $prometheus -eq 0 ]; then
    echo "Prometheus targets status:"
    curl -s "http://localhost:9090/api/v1/targets" | jq -r '.data.activeTargets[] | "\(.labels.job): \(.health) - \(.lastError // "OK")"' 2>/dev/null || echo "jq not available, check http://localhost:9090/targets manually"
else
    echo "❌ Prometheus not accessible"
fi

echo ""
echo "🐳 Container Status:"
echo "------------------"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" --filter "name=questdb\|telemetry_service\|rabbitmq\|prometheus"

echo ""
echo "📋 Next Steps:"
echo "1. Check container logs: docker logs <container_name>"
echo "2. Verify Prometheus targets: http://localhost:9090/targets"
echo "3. Check Grafana data sources: http://localhost:3002"
echo "4. If QuestDB metrics show 0, ensure QDB_METRICS_ENABLED=true took effect"
echo "5. If C# metrics missing, ensure the service rebuilt with prometheus-net package"