# Security Configuration

## Environment Variables

This project uses environment variables to keep sensitive data secure. 

### Setup Instructions

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Update the `.env` file with your secure values:**
   - Generate strong passwords for all services
   - Use unique credentials for each service
   - Never commit the `.env` file to version control

### Required Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `QUESTDB_PASSWORD` | QuestDB admin password | `your_secure_password` |
| `RABBITMQ_DEFAULT_USER` | RabbitMQ username | `your_rabbitmq_user` |
| `RABBITMQ_DEFAULT_PASS` | RabbitMQ password | `your_secure_password` |
| `GF_SECURITY_ADMIN_PASSWORD` | Grafana admin password | `your_secure_admin_password` |
| `TRAEFIK_DASHBOARD_AUTH` | Traefik dashboard auth hash | `admin:$2y$10$...` |
| `LETSENCRYPT_EMAIL` | Email for Let's Encrypt | `your-email@example.com` |
| `HOST_IP` | Host IP address | `192.168.1.202` |

### Generating Traefik Authentication Hash

To generate a secure hash for Traefik dashboard authentication:

```bash
# Using htpasswd (recommended)
htpasswd -nb admin your_secure_password

# Using openssl (alternative)
echo $(htpasswd -nbB admin "your_secure_password") | sed -e s/\\$/\\$\\$/g
```

### SSL/TLS Certificates

For local development:
```bash
./generate-traefik-certs.sh
```

For production, uncomment the Let's Encrypt configuration in `docker-compose.yml`.

## Security Best Practices

1. **Never commit sensitive data** to version control
2. **Use strong, unique passwords** for all services
3. **Regularly rotate credentials**
4. **Keep Docker images updated**
5. **Monitor access logs** for suspicious activity
6. **Use HTTPS** in production environments
7. **Restrict network access** to necessary ports only

## Default Ports

| Service | Port | Protocol | Access |
|---------|------|----------|--------|
| Traefik | 80 | HTTP | Redirects to HTTPS |
| Traefik | 443 | HTTPS | Main access point |
| Traefik Dashboard | 8080 | HTTP | Admin only |
| RabbitMQ | 5672 | AMQP | Internal only |
| QuestDB | 9000 | HTTP | Internal only |
| Prometheus | 9090 | HTTP | Internal only |
| Grafana | 3000 | HTTP | Internal only |

## Firewall Configuration

For production deployment, ensure only necessary ports are exposed:

```bash
# Allow HTTPS traffic
sudo ufw allow 443/tcp

# Allow HTTP traffic (for redirects)
sudo ufw allow 80/tcp

# Allow SSH (if needed for remote access)
sudo ufw allow 22/tcp

# Enable firewall
sudo ufw enable
```

## Security Contacts

For security issues, please contact: [security@yourorganization.com]