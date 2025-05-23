# Blockchain Transaction Indexer for Multi-Chain Producers

A scalable, modular blockchain indexing system designed to monitor multiple blockchains simultaneously, filter transactions based on event topic hashes, and publish the filtered data to Redis Pub/Sub for downstream consumers.

## Architecture

This system follows a factory pattern architecture to enable scalability, modularity, and extensibility across multiple blockchains. The key components are:

### Core Components

1. **Blockchain Providers**: Chain-specific implementations that connect to blockchain nodes via RPC and WebSocket, handling block retrieval, transaction receipts, and new block subscriptions.

2. **Events Processor**: Processes blocks and filters transactions based on configured Topic0 event hashes, using transaction receipts to extract event logs.

3. **Redis Publisher**: Publishes filtered blockchain data to Redis channels for downstream consumers.

4. **Indexer Service**: Coordinates the entire process, maintaining state, and ensuring reliable data flow.

5. **Processed Blocks Service**: Tracks processed blocks in the database to ensure exactly-once processing and handle chain reorganizations.

### Design Patterns

- **Factory Pattern**: Used to create chain-specific providers and services
- **Interface-based Design**: All components implement well-defined interfaces
- **Dependency Injection**: Components are composed rather than tightly coupled
- **Observer Pattern**: For blockchain event subscriptions
- **Singleton**: For shared resources like logger and configuration

### Reliability Features

- **Automatic Recovery**: Self-healing through health checks
- **Retry Mechanism**: Configurable retry policies for failed operations
- **Block Confirmation**: Configurable confirmation depth for finality
- **Graceful Shutdown**: Proper cleanup of resources on termination
- **Error Handling**: Comprehensive error logging and management
- **Block Tracking**: Persistent storage of processed blocks
- **Reorg Handling**: Detection and handling of chain reorganizations

## Getting Started

### Prerequisites

- Node.js (v18+)
- TypeScript
- Redis server
- PostgreSQL database
- Access to blockchain RPC endpoints (Ethereum, Polygon, etc.)

### Installation

1. Clone the repository:

```
git clone <repository-url>
cd poc-producers
```

2. Install dependencies:

```
yarn install
```

3. Create a `.env` file based on the example config:

```
NODE_ENV=development
LOG_LEVEL=info

API_PORT=3000
API_HOST=0.0.0.0

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=your_password  # Optional
REDIS_DATABASE=0              # Optional, default is 0
REDIS_CHANNEL=blockchain-events
REDIS_USERNAME=your_username  # Optional
REDIS_TLS=false              # Optional, set to true for TLS

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=blockchain_indexer
DB_LOGGING=true
DB_SSL=false

# Chain Configurations
ARBITRUM_SEPOLIA_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
ARBITRUM_SEPOLIA_WS_URL=wss://mainnet.infura.io/ws/v3/YOUR_INFURA_KEY
ARBITRUM_SEPOLIA_CHAIN_ID=421614
ARBITRUM_SEPOLIA_BLOCK_CONFIRMATIONS=12
ARBITRUM_SEPOLIA_START_BLOCK=18000000

# System Configuration
HEALTH_CHECK_INTERVAL=60000
RETRY_DELAY=5000
MAX_RETRIES=5
INDEXING_BATCH_SIZE=100
```

4. Set up the database:

```
yarn migration:run
```

5. Build the project:

```
yarn build
```

6. Start the service:

```
yarn start
```

For development with hot reloading:

```
yarn dev
```

## API Endpoints

The service exposes REST APIs for monitoring and management:

- `GET /health` - Overall service health check
- `GET /api/indexers/:chainName/status` - Get indexer status for a specific chain
- `GET /api/indexers/:chainName/filters` - Get current topic filters for a chain
- `POST /api/indexers/:chainName/filters` - Add a new topic filter
- `DELETE /api/indexers/:chainName/filters/:hash` - Remove a topic filter
- `POST /api/indexers/:chainName/pause` - Pause an indexer
- `POST /api/indexers/:chainName/resume` - Resume a paused indexer

## Redis Message Format

Messages published to Redis have the following enhanced format with metadata:

```typescript
{
  transaction: {
    blockHash: string;
    blockNumber: number;
    hash: string;
    from: string;
    to: string;
    value: bigint;
    data: string;
    // ... other transaction fields
    chainId: number;
    chainName: string;
    topics: string[]; // Matched Topic0 hashes
  },
  events: any[];
  timestamp: number;
  metadata: {
    chainId: number;
    chainName: string;
    blockNumber: number;
    transactionHash: string;
    timestamp: number;
  }
}
```

## Database Schema

The system uses PostgreSQL to track processed blocks:

### Processed Blocks Table

```sql
CREATE TABLE processed_blocks (
  id UUID PRIMARY KEY,
  chain_id INTEGER NOT NULL,
  block_number INTEGER NOT NULL,
  block_hash VARCHAR(66) NOT NULL,
  parent_hash VARCHAR(66) NOT NULL,
  block_data JSONB,
  is_reorged BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_processed_blocks_chain_id ON processed_blocks(chain_id);
CREATE INDEX idx_processed_blocks_block_number ON processed_blocks(block_number);
```

## Extending the System

### Adding a New Blockchain

1. Create a new provider implementation in `src/providers/`
2. Update `BlockchainProviderFactory` to support the new chain
3. Add configuration for the new chain in `src/config/env.ts`

### Adding New Event Types

Simply add new Topic0 hashes to the filter list via API or in the initial configuration.

## Architecture Justification

### Scalability

- **Horizontal Scaling**: Each chain can be run as a separate instance
- **Parallel Processing**: Blocks are processed in batches with configurable concurrency
- **Kafka Backend**: Enables downstream scaling through consumer groups
- **Database Indexing**: Efficient block tracking and reorg detection

### Reliability

- **No Single Point of Failure**: Each chain operates independently
- **Self-Healing**: Health checks detect and recover from failures
- **Exactly-Once Processing**: Database-backed block tracking ensures no duplicates
- **Reorg Protection**: Block hash tracking detects and handles chain reorganizations

### Modularity

- **Factory Pattern**: Makes it easy to add new chains without changing core code
- **Interface-Based Design**: Components can be swapped or extended with minimal impact
- **Clean Separation**: Each component has a single responsibility

### Production-Readiness

- **Comprehensive Logging**: Structured logging with Winston
- **Configurable**: All parameters can be tuned via environment variables
- **Health Monitoring**: Built-in health checks and status APIs
- **Resource Management**: Proper handling of connections and cleanup
- **Data Persistence**: Reliable block tracking in PostgreSQL

## License

MIT
