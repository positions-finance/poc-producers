# Blockchain Transaction Indexer for Multi-Chain Producers

A scalable, modular blockchain indexing system designed to monitor multiple blockchains simultaneously, filter transactions based on event topic hashes, and produce the filtered data to Kafka for downstream consumers.

## Architecture

This system follows a factory pattern architecture to enable scalability, modularity, and extensibility across multiple blockchains. The key components are:

### Core Components

1. **Blockchain Providers**: Chain-specific implementations that connect to blockchain nodes via RPC and WebSocket, handling block retrieval and new block subscriptions.

2. **Events Processor**: Processes blocks and filters transactions based on configured Topic0 event hashes.

3. **Kafka Producer**: Sends filtered blockchain data to Kafka topics for downstream consumers.

4. **Indexer Service**: Coordinates the entire process, maintaining state, and ensuring reliable data flow.

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

## Getting Started

### Prerequisites

- Node.js (v18+)
- TypeScript
- Kafka cluster
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

KAFKA_CLIENT_ID=blockchain-indexer
KAFKA_BROKERS=localhost:9092
KAFKA_TOPIC=blockchain-transactions

ARBITRUM_SEPOLIA_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY
ARBITRUM_SEPOLIA_WS_URL=wss://mainnet.infura.io/ws/v3/YOUR_INFURA_KEY
ARBITRUM_SEPOLIA_BLOCK_CONFIRMATIONS=12
ARBITRUM_SEPOLIA_START_BLOCK=18000000

BEPOLIA_RPC_URL=https://polygon-rpc.com
BEPOLIA_WS_URL=wss://polygon-rpc.com
BEPOLIA_BLOCK_CONFIRMATIONS=15
BEPOLIA_START_BLOCK=50000000

HEALTH_CHECK_INTERVAL=60000
RETRY_DELAY=5000
MAX_RETRIES=5
INDEXING_BATCH_SIZE=100
```

4. Build the project:

```
yarn build
```

5. Start the service:

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

## Kafka Message Format

Messages produced to Kafka have the following format:

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
  timestamp: number;
  topics: string[];
}
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

### Reliability

- **No Single Point of Failure**: Each chain operates independently
- **Self-Healing**: Health checks detect and recover from failures
- **Exactly-Once Processing**: Careful block tracking ensures no duplicates or missed blocks

### Modularity

- **Factory Pattern**: Makes it easy to add new chains without changing core code
- **Interface-Based Design**: Components can be swapped or extended with minimal impact
- **Clean Separation**: Each component has a single responsibility

### Production-Readiness

- **Comprehensive Logging**: Structured logging with Winston
- **Configurable**: All parameters can be tuned via environment variables
- **Health Monitoring**: Built-in health checks and status APIs
- **Resource Management**: Proper handling of connections and cleanup

## License

MIT
