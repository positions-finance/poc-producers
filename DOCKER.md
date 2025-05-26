# Docker Deployment Guide

This guide explains how to build and run the Blockchain Transaction Indexer using Docker.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose 2.0+

## Building the Docker Image

### Build the image locally:

```bash
docker build -t blockchain-indexer .
```

### Build with specific tag:

```bash
docker build -t blockchain-indexer:v1.0.0 .
```

## Running with Docker

### Option 1: Run the container directly

First, make sure you have Redis and PostgreSQL running and accessible. Then:

```bash
docker run -d \
  --name blockchain-indexer \
  -p 8080:8080 \
  -e REDIS_HOST=your-redis-host \
  -e REDIS_PORT=6379 \
  -e DB_HOST=your-postgres-host \
  -e DB_PORT=5432 \
  -e DB_USERNAME=postgres \
  -e DB_PASSWORD=your-password \
  -e DB_NAME=blockchain_indexer \
  -e BEPOLIA_RPC_URL=your-rpc-url \
  -e BEPOLIA_WS_URL=your-ws-url \
  blockchain-indexer
```

### Option 2: Use Docker Compose (Application Only)

If you have external Redis and PostgreSQL services:

1. Create a `.env` file with your configuration:

```bash
# Redis Configuration
REDIS_HOST=your-redis-host
REDIS_PORT=6379
REDIS_PASSWORD=your-redis-password

# Database Configuration
DB_HOST=your-postgres-host
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your-postgres-password
DB_NAME=blockchain_indexer

# Chain Configuration
BEPOLIA_RPC_URL=https://your-rpc-endpoint.com
BEPOLIA_WS_URL=wss://your-ws-endpoint.com
```

2. Run with Docker Compose:

```bash
docker-compose -f docker-compose.app.yml up -d
```

### Option 3: Full Stack with Docker Compose

To run the complete stack including Redis and PostgreSQL:

```bash
docker-compose -f docker-compose.full.yml up -d
```

This will start:

- PostgreSQL database on port 5432
- Redis server on port 6379
- Blockchain Indexer application on port 8080

## Environment Variables

### Required Variables

| Variable      | Description           | Default              |
| ------------- | --------------------- | -------------------- |
| `REDIS_HOST`  | Redis server hostname | `localhost`          |
| `REDIS_PORT`  | Redis server port     | `6379`               |
| `DB_HOST`     | PostgreSQL hostname   | `localhost`          |
| `DB_PORT`     | PostgreSQL port       | `5432`               |
| `DB_USERNAME` | Database username     | `postgres`           |
| `DB_PASSWORD` | Database password     | `postgres`           |
| `DB_NAME`     | Database name         | `blockchain_indexer` |

### Chain Configuration

Configure at least one blockchain to index:

| Variable                      | Description                      |
| ----------------------------- | -------------------------------- |
| `BEPOLIA_RPC_URL`             | RPC endpoint URL                 |
| `BEPOLIA_WS_URL`              | WebSocket endpoint URL           |
| `BEPOLIA_CHAIN_ID`            | Chain ID (default: 11155111)     |
| `BEPOLIA_BLOCK_CONFIRMATIONS` | Block confirmations (default: 2) |
| `BEPOLIA_START_BLOCK`         | Starting block number (optional) |

### Optional Variables

| Variable                | Description                | Default      |
| ----------------------- | -------------------------- | ------------ |
| `NODE_ENV`              | Environment                | `production` |
| `LOG_LEVEL`             | Logging level              | `info`       |
| `API_PORT`              | API server port            | `8080`       |
| `API_HOST`              | API server host            | `0.0.0.0`    |
| `HEALTH_CHECK_INTERVAL` | Health check interval (ms) | `30000`      |
| `RETRY_DELAY`           | Retry delay (ms)           | `300`        |
| `MAX_RETRIES`           | Maximum retries            | `5`          |
| `INDEXING_BATCH_SIZE`   | Batch size for indexing    | `100`        |

## Health Checks

The Docker image includes a built-in health check that monitors the `/health` endpoint. You can check the health status:

```bash
docker ps
```

The health status will be shown in the STATUS column.

## Logs

View application logs:

```bash
# For direct Docker run
docker logs blockchain-indexer

# For Docker Compose
docker-compose -f docker-compose.full.yml logs blockchain-indexer
```

Follow logs in real-time:

```bash
docker logs -f blockchain-indexer
```

## Stopping the Application

### Direct Docker run:

```bash
docker stop blockchain-indexer
docker rm blockchain-indexer
```

### Docker Compose:

```bash
# Application only
docker-compose -f docker-compose.app.yml down

# Full stack
docker-compose -f docker-compose.full.yml down

# Remove volumes as well
docker-compose -f docker-compose.full.yml down -v
```

## Troubleshooting

### Check if the container is running:

```bash
docker ps
```

### Check container logs:

```bash
docker logs blockchain-indexer
```

### Execute commands inside the container:

```bash
docker exec -it blockchain-indexer sh
```

### Check health endpoint:

```bash
curl http://localhost:8080/health
```

### Common Issues

1. **Connection refused to Redis/PostgreSQL**: Ensure the services are running and accessible from the container.

2. **Permission denied**: The application runs as a non-root user. Ensure any mounted volumes have proper permissions.

3. **Out of memory**: The application may require more memory for large blockchain indexing operations. Increase Docker memory limits if needed.

4. **Network issues**: If using Docker Compose, ensure all services are on the same network.

## Production Considerations

1. **Resource Limits**: Set appropriate CPU and memory limits:

```yaml
services:
  blockchain-indexer:
    # ... other config
    deploy:
      resources:
        limits:
          cpus: "2.0"
          memory: 2G
        reservations:
          cpus: "1.0"
          memory: 1G
```

2. **Persistent Storage**: Use named volumes or bind mounts for database data:

```yaml
volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
```

3. **Security**: Use secrets for sensitive environment variables in production.

4. **Monitoring**: Consider adding monitoring and alerting for the health endpoints.

5. **Backup**: Implement regular backups for PostgreSQL data.
