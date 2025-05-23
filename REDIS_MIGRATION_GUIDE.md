# Kafka to Redis Pub/Sub Migration Guide

This guide provides comprehensive information for migrating from Kafka to Redis Pub/Sub for the blockchain transaction indexer system.

## Overview

The system has been migrated from Apache Kafka to Redis Pub/Sub for message streaming. This change simplifies the architecture while maintaining high performance and reliability.

### Key Changes

- **Message Broker**: Kafka → Redis Pub/Sub
- **Configuration**: Environment variables updated
- **Dependencies**: `kafkajs` → `redis`
- **Infrastructure**: Kafka + Zookeeper → Redis
- **Message Format**: Enhanced with metadata

## Architecture Changes

### Before (Kafka)

```
Producer → Kafka Topic → Consumer Group → Consumer
```

### After (Redis Pub/Sub)

```
Publisher → Redis Channel → Subscriber
```

## Environment Configuration

### Old Kafka Configuration

```bash
# Kafka Configuration (DEPRECATED)
KAFKA_CLIENT_ID=blockchain-indexer
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=blockchain-events
```

### New Redis Configuration

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password  # Optional
REDIS_DATABASE=0              # Optional, default is 0
REDIS_CHANNEL=blockchain-events
REDIS_USERNAME=your_username  # Optional
REDIS_TLS=false              # Optional, set to true for TLS
```

## Message Format Changes

### Enhanced Message Structure

Messages now include additional metadata for easier processing:

```json
{
  "transaction": {
    "hash": "0x...",
    "blockNumber": 12345,
    "chainId": 1,
    "chainName": "ethereum",
    "from": "0x...",
    "to": "0x...",
    "value": "1000000000000000000",
    "gasUsed": "21000",
    "gasPrice": "20000000000",
    "status": "success",
    "logs": [...],
    "timestamp": 1234567890
  },
  "events": [...],
  "timestamp": 1234567890,
  "metadata": {
    "chainId": 1,
    "chainName": "ethereum",
    "blockNumber": 12345,
    "transactionHash": "0x...",
    "timestamp": 1234567890
  }
}
```

## Consumer Migration Guide

### 1. Install Redis Client

#### Node.js

```bash
npm install redis
# or
yarn add redis
```

#### Python

```bash
pip install redis
```

#### Java

```xml
<dependency>
    <groupId>redis.clients</groupId>
    <artifactId>jedis</artifactId>
    <version>4.4.0</version>
</dependency>
```

#### Go

```bash
go get github.com/redis/go-redis/v9
```

### 2. Implementation Examples

#### Node.js/TypeScript Consumer

```typescript
import { createClient } from "redis";

interface RedisConsumerConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  channel: string;
  username?: string;
  tls?: boolean;
}

class RedisConsumer {
  private client: RedisClientType;
  private subscriber: RedisClientType;

  constructor(private config: RedisConsumerConfig) {
    const redisConfig = {
      socket: {
        host: this.config.host,
        port: this.config.port,
        tls: this.config.tls || false,
      },
      database: this.config.database || 0,
    };

    if (this.config.password) {
      redisConfig.password = this.config.password;
    }

    if (this.config.username) {
      redisConfig.username = this.config.username;
    }

    this.client = createClient(redisConfig);
    this.subscriber = this.client.duplicate();
  }

  async connect(): Promise<void> {
    await this.client.connect();
    await this.subscriber.connect();
    console.log("Connected to Redis");
  }

  async subscribe(callback: (message: any) => void): Promise<void> {
    await this.subscriber.subscribe(this.config.channel, (message) => {
      try {
        const parsedMessage = JSON.parse(message);
        callback(parsedMessage);
      } catch (error) {
        console.error("Failed to parse message:", error);
      }
    });

    console.log(`Subscribed to channel: ${this.config.channel}`);
  }

  async disconnect(): Promise<void> {
    await this.subscriber.disconnect();
    await this.client.disconnect();
    console.log("Disconnected from Redis");
  }
}

// Usage
const consumer = new RedisConsumer({
  host: "localhost",
  port: 6379,
  channel: "blockchain-events",
  password: process.env.REDIS_PASSWORD,
});

async function main() {
  await consumer.connect();

  await consumer.subscribe((message) => {
    console.log("Received blockchain transaction:", {
      hash: message.transaction.hash,
      chainName: message.metadata.chainName,
      blockNumber: message.metadata.blockNumber,
    });

    // Process your message here
    processBlockchainTransaction(message);
  });
}

function processBlockchainTransaction(message: any) {
  // Your business logic here
  console.log("Processing transaction:", message.transaction.hash);
}

main().catch(console.error);
```

#### Python Consumer

```python
import redis
import json
import logging
from typing import Dict, Any, Optional

class RedisConsumer:
    def __init__(self, host: str, port: int, channel: str,
                 password: Optional[str] = None, db: int = 0,
                 username: Optional[str] = None, ssl: bool = False):
        self.host = host
        self.port = port
        self.channel = channel
        self.password = password
        self.db = db
        self.username = username
        self.ssl = ssl

        self.client = redis.Redis(
            host=host,
            port=port,
            password=password,
            db=db,
            username=username,
            ssl=ssl,
            decode_responses=True
        )

        self.pubsub = self.client.pubsub()

    def connect(self):
        """Test connection"""
        try:
            self.client.ping()
            logging.info(f"Connected to Redis at {self.host}:{self.port}")
        except redis.ConnectionError as e:
            logging.error(f"Failed to connect to Redis: {e}")
            raise

    def subscribe(self, callback):
        """Subscribe to the channel and process messages"""
        self.pubsub.subscribe(self.channel)
        logging.info(f"Subscribed to channel: {self.channel}")

        for message in self.pubsub.listen():
            if message['type'] == 'message':
                try:
                    data = json.loads(message['data'])
                    callback(data)
                except json.JSONDecodeError as e:
                    logging.error(f"Failed to parse message: {e}")
                except Exception as e:
                    logging.error(f"Error processing message: {e}")

    def disconnect(self):
        """Disconnect from Redis"""
        self.pubsub.close()
        self.client.close()
        logging.info("Disconnected from Redis")

def process_blockchain_transaction(message: Dict[str, Any]):
    """Process blockchain transaction message"""
    transaction = message.get('transaction', {})
    metadata = message.get('metadata', {})

    print(f"Processing transaction: {transaction.get('hash')}")
    print(f"Chain: {metadata.get('chainName')}")
    print(f"Block: {metadata.get('blockNumber')}")

    # Your business logic here

# Usage
if __name__ == "__main__":
    consumer = RedisConsumer(
        host='localhost',
        port=6379,
        channel='blockchain-events',
        password=None  # Set if needed
    )

    try:
        consumer.connect()
        consumer.subscribe(process_blockchain_transaction)
    except KeyboardInterrupt:
        print("Shutting down...")
    finally:
        consumer.disconnect()
```

#### Java Consumer

```java
import redis.clients.jedis.Jedis;
import redis.clients.jedis.JedisPubSub;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.logging.Logger;

public class RedisConsumer {
    private static final Logger logger = Logger.getLogger(RedisConsumer.class.getName());

    private final String host;
    private final int port;
    private final String channel;
    private final String password;
    private final ObjectMapper objectMapper;
    private Jedis jedis;

    public RedisConsumer(String host, int port, String channel, String password) {
        this.host = host;
        this.port = port;
        this.channel = channel;
        this.password = password;
        this.objectMapper = new ObjectMapper();
    }

    public void connect() {
        jedis = new Jedis(host, port);
        if (password != null && !password.isEmpty()) {
            jedis.auth(password);
        }
        logger.info("Connected to Redis at " + host + ":" + port);
    }

    public void subscribe(MessageProcessor processor) {
        JedisPubSub pubSub = new JedisPubSub() {
            @Override
            public void onMessage(String channel, String message) {
                try {
                    // Parse JSON message
                    Object messageData = objectMapper.readValue(message, Object.class);
                    processor.process(messageData);
                } catch (Exception e) {
                    logger.severe("Failed to process message: " + e.getMessage());
                }
            }
        };

        logger.info("Subscribing to channel: " + channel);
        jedis.subscribe(pubSub, channel);
    }

    public void disconnect() {
        if (jedis != null) {
            jedis.close();
            logger.info("Disconnected from Redis");
        }
    }

    @FunctionalInterface
    public interface MessageProcessor {
        void process(Object message);
    }

    // Usage example
    public static void main(String[] args) {
        RedisConsumer consumer = new RedisConsumer("localhost", 6379, "blockchain-events", null);

        try {
            consumer.connect();
            consumer.subscribe(message -> {
                System.out.println("Received message: " + message);
                // Process your blockchain transaction here
            });
        } catch (Exception e) {
            e.printStackTrace();
        } finally {
            consumer.disconnect();
        }
    }
}
```

#### Go Consumer

```go
package main

import (
    "context"
    "encoding/json"
    "fmt"
    "log"
    "os"
    "os/signal"
    "syscall"

    "github.com/redis/go-redis/v9"
)

type RedisConsumer struct {
    client  *redis.Client
    channel string
}

type BlockchainMessage struct {
    Transaction struct {
        Hash        string `json:"hash"`
        BlockNumber int    `json:"blockNumber"`
        ChainID     int    `json:"chainId"`
        ChainName   string `json:"chainName"`
        From        string `json:"from"`
        To          string `json:"to"`
        Value       string `json:"value"`
        GasUsed     string `json:"gasUsed"`
        GasPrice    string `json:"gasPrice"`
        Status      string `json:"status"`
        Timestamp   int64  `json:"timestamp"`
    } `json:"transaction"`
    Events    []interface{} `json:"events"`
    Timestamp int64         `json:"timestamp"`
    Metadata  struct {
        ChainID         int    `json:"chainId"`
        ChainName       string `json:"chainName"`
        BlockNumber     int    `json:"blockNumber"`
        TransactionHash string `json:"transactionHash"`
        Timestamp       int64  `json:"timestamp"`
    } `json:"metadata"`
}

func NewRedisConsumer(host string, port int, password, channel string) *RedisConsumer {
    rdb := redis.NewClient(&redis.Options{
        Addr:     fmt.Sprintf("%s:%d", host, port),
        Password: password,
        DB:       0,
    })

    return &RedisConsumer{
        client:  rdb,
        channel: channel,
    }
}

func (r *RedisConsumer) Connect(ctx context.Context) error {
    _, err := r.client.Ping(ctx).Result()
    if err != nil {
        return fmt.Errorf("failed to connect to Redis: %w", err)
    }
    log.Printf("Connected to Redis")
    return nil
}

func (r *RedisConsumer) Subscribe(ctx context.Context, processor func(BlockchainMessage)) error {
    pubsub := r.client.Subscribe(ctx, r.channel)
    defer pubsub.Close()

    log.Printf("Subscribed to channel: %s", r.channel)

    ch := pubsub.Channel()
    for msg := range ch {
        var blockchainMsg BlockchainMessage
        if err := json.Unmarshal([]byte(msg.Payload), &blockchainMsg); err != nil {
            log.Printf("Failed to parse message: %v", err)
            continue
        }

        processor(blockchainMsg)
    }

    return nil
}

func (r *RedisConsumer) Disconnect() error {
    return r.client.Close()
}

func processBlockchainTransaction(message BlockchainMessage) {
    fmt.Printf("Processing transaction: %s\n", message.Transaction.Hash)
    fmt.Printf("Chain: %s\n", message.Metadata.ChainName)
    fmt.Printf("Block: %d\n", message.Metadata.BlockNumber)

    // Your business logic here
}

func main() {
    consumer := NewRedisConsumer("localhost", 6379, "", "blockchain-events")

    ctx := context.Background()

    if err := consumer.Connect(ctx); err != nil {
        log.Fatal(err)
    }
    defer consumer.Disconnect()

    // Handle graceful shutdown
    c := make(chan os.Signal, 1)
    signal.Notify(c, os.Interrupt, syscall.SIGTERM)

    go func() {
        <-c
        log.Println("Shutting down...")
        consumer.Disconnect()
        os.Exit(0)
    }()

    // Start consuming
    if err := consumer.Subscribe(ctx, processBlockchainTransaction); err != nil {
        log.Fatal(err)
    }
}
```

## Infrastructure Changes

### Docker Compose

The new `docker-compose.yml` includes Redis instead of Kafka:

```yaml
services:
  redis:
    image: redis:7.2-alpine
    hostname: redis
    container_name: redis
    ports:
      - "6379:6379"
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    environment:
      - REDIS_PASSWORD=${REDIS_PASSWORD:-}
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

volumes:
  redis_data:
```

### Production Deployment

#### Redis Cluster (Recommended for Production)

For high availability, consider using Redis Cluster:

```yaml
services:
  redis-node-1:
    image: redis:7.2-alpine
    command: redis-server --port 7001 --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7001:7001"
    volumes:
      - redis_data_1:/data

  redis-node-2:
    image: redis:7.2-alpine
    command: redis-server --port 7002 --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7002:7002"
    volumes:
      - redis_data_2:/data

  redis-node-3:
    image: redis:7.2-alpine
    command: redis-server --port 7003 --cluster-enabled yes --cluster-config-file nodes.conf --cluster-node-timeout 5000 --appendonly yes
    ports:
      - "7003:7003"
    volumes:
      - redis_data_3:/data
```

## Performance Considerations

### Redis vs Kafka

| Aspect               | Kafka      | Redis Pub/Sub         |
| -------------------- | ---------- | --------------------- |
| **Throughput**       | Very High  | High                  |
| **Latency**          | Low        | Very Low              |
| **Persistence**      | Excellent  | Good (with AOF)       |
| **Scalability**      | Horizontal | Vertical + Clustering |
| **Complexity**       | High       | Low                   |
| **Memory Usage**     | Lower      | Higher                |
| **Message Ordering** | Guaranteed | Best Effort           |
| **Consumer Groups**  | Yes        | No (Pattern-based)    |

### Optimization Tips

1. **Memory Management**

   ```bash
   # Configure Redis memory policy
   maxmemory 2gb
   maxmemory-policy allkeys-lru
   ```

2. **Persistence Configuration**

   ```bash
   # AOF for durability
   appendonly yes
   appendfsync everysec
   ```

3. **Connection Pooling**
   - Use connection pooling in your consumers
   - Reuse connections when possible

## Monitoring and Observability

### Redis Monitoring Commands

```bash
# Monitor Redis activity
redis-cli monitor

# Get Redis info
redis-cli info

# Check pub/sub channels
redis-cli pubsub channels

# Check number of subscribers
redis-cli pubsub numsub blockchain-events
```

### Health Checks

```bash
# Simple health check
redis-cli ping

# Check if Redis is accepting connections
redis-cli --latency
```

## Troubleshooting

### Common Issues

1. **Connection Timeout**

   ```bash
   # Check Redis is running
   redis-cli ping

   # Check port is open
   telnet localhost 6379
   ```

2. **Message Loss**

   ```bash
   # Enable AOF persistence
   redis-cli config set appendonly yes
   ```

3. **High Memory Usage**

   ```bash
   # Check memory usage
   redis-cli info memory

   # Set memory limit
   redis-cli config set maxmemory 1gb
   ```

4. **Slow Performance**
   ```bash
   # Check slow queries
   redis-cli slowlog get 10
   ```

## Migration Checklist

- [ ] Update environment variables
- [ ] Install Redis client libraries
- [ ] Update consumer code
- [ ] Test Redis connectivity
- [ ] Deploy Redis infrastructure
- [ ] Update monitoring/alerting
- [ ] Test message flow end-to-end
- [ ] Monitor performance metrics
- [ ] Update documentation
- [ ] Train team on Redis operations

## Support

For issues related to the migration:

1. **Producer Issues**: Check the indexer logs and Redis connectivity
2. **Consumer Issues**: Verify Redis client configuration and channel subscription
3. **Infrastructure Issues**: Monitor Redis health and resource usage
4. **Performance Issues**: Review Redis configuration and client implementation

## Additional Resources

- [Redis Pub/Sub Documentation](https://redis.io/docs/interact/pubsub/)
- [Redis Client Libraries](https://redis.io/docs/clients/)
- [Redis Best Practices](https://redis.io/docs/management/optimization/)
- [Redis Monitoring](https://redis.io/docs/management/monitoring/)
