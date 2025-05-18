import "dotenv/config";
import { EnvConfig } from "../utils/types/config.types";

const config: EnvConfig = {
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",
  api: {
    port: parseInt(process.env.API_PORT || "8080", 10),
    host: process.env.API_HOST || "0.0.0.0",
  },
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || "poc-producers",
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    topic: process.env.KAFKA_TOPIC || "poc-producers",
  },
  chains: {
    arbitrumSepolia: {
      rpcUrl:
        process.env.ARBITRUM_SEPOLIA_RPC_URL ||
        "https://sepolia.infura.io/v3/YOUR_INFURA_KEY",
      wsUrl:
        process.env.ARBITRUM_SEPOLIA_WS_URL ||
        "wss://sepolia.infura.io/ws/v3/YOUR_INFURA_KEY",
      chainId: 421614,
      blockConfirmations: 2,
      startBlock: process.env.ARBITRUM_SEPOLIA_START_BLOCK
        ? parseInt(process.env.ARBITRUM_SEPOLIA_START_BLOCK, 10)
        : undefined,
    },
    bepolia: {
      rpcUrl:
        process.env.BEPOLIA_RPC_URL ||
        "https://bepolia.infura.io/v3/YOUR_INFURA_KEY",
      wsUrl:
        process.env.BEPOLIA_WS_URL ||
        "wss://bepolia.infura.io/ws/v3/YOUR_INFURA_KEY",
      chainId: 80069,
      blockConfirmations: 2,
      startBlock: process.env.BEPOLIA_START_BLOCK
        ? parseInt(process.env.BEPOLIA_START_BLOCK, 10)
        : undefined,
    },
  },
  healthCheckInterval: parseInt(
    process.env.HEALTH_CHECK_INTERVAL || "60000",
    10
  ),
  retryDelay: parseInt(process.env.RETRY_DELAY || "5000", 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || "5", 10),
  indexingBatchSize: parseInt(process.env.INDEXING_BATCH_SIZE || "100", 10),
};

export default config;
