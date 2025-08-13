#!/bin/bash
# RabbitMQ User Initialization Script
# This script runs after RabbitMQ starts to create users and set permissions

# Set RabbitMQ node name for remote operations
export RABBITMQ_NODENAME=rabbit@rabbitmq

# Wait for RabbitMQ to be ready
echo "Waiting for RabbitMQ to be ready..."
until rabbitmqctl -n $RABBITMQ_NODENAME ping; do
    echo "Still waiting for RabbitMQ..."
    sleep 3
done

echo "RabbitMQ is ready. Setting up users..."

# Get credentials from environment variables
RABBITMQ_ADMIN_USER=${RABBITMQ_USER:-admin}
RABBITMQ_ADMIN_PASS=${RABBITMQ_PASS:-changeme}

# Create guest user if it doesn't exist (for backward compatibility)
if ! rabbitmqctl -n $RABBITMQ_NODENAME list_users | grep -q "^guest"; then
    echo "Creating guest user..."
    rabbitmqctl -n $RABBITMQ_NODENAME add_user guest $RABBITMQ_ADMIN_PASS
    rabbitmqctl -n $RABBITMQ_NODENAME set_user_tags guest administrator
    rabbitmqctl -n $RABBITMQ_NODENAME set_permissions -p / guest ".*" ".*" ".*"
    echo "Guest user created successfully"
else
    echo "Guest user already exists"
    # Update password in case it changed
    rabbitmqctl -n $RABBITMQ_NODENAME change_password guest $RABBITMQ_ADMIN_PASS
fi

# Ensure admin user has correct permissions
echo "Setting admin user permissions..."
rabbitmqctl -n $RABBITMQ_NODENAME set_user_tags $RABBITMQ_ADMIN_USER administrator
rabbitmqctl -n $RABBITMQ_NODENAME set_permissions -p / $RABBITMQ_ADMIN_USER ".*" ".*" ".*"

echo "RabbitMQ user setup complete!"