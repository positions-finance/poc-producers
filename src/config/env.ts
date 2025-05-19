import "dotenv/config";
import { EnvConfig } from "../utils/types/config.types";

const config: EnvConfig = {
  nodeEnv: process.env.NODE_ENV || "development",
  logLevel: process.env.LOG_LEVEL || "info",
  api: {
    port: parseInt(process.env.API_PORT || "8080", 10),
    host: process.env.API_HOST || "localhost",
  },
  kafka: {
    clientId: process.env.KAFKA_CLIENT_ID || "blockchain-indexer",
    brokers: (process.env.KAFKA_BROKERS || "localhost:9092").split(","),
    topic: process.env.KAFKA_TOPIC || "blockchain-events",
  },
  chains: {
    "arbitrum-sepolia": {
      rpcUrl: process.env.ARBITRUM_SEPOLIA_RPC_URL || "",
      wsUrl: process.env.ARBITRUM_SEPOLIA_WS_URL || "",
      chainId: parseInt(process.env.ARBITRUM_SEPOLIA_CHAIN_ID || "421614", 10),
      blockConfirmations: parseInt(
        process.env.ARBITRUM_SEPOLIA_BLOCK_CONFIRMATIONS || "2",
        10
      ),
      startBlock: process.env.ARBITRUM_SEPOLIA_START_BLOCK
        ? parseInt(process.env.ARBITRUM_SEPOLIA_START_BLOCK, 10)
        : undefined,
    },
    // bepolia: {
    //   rpcUrl: process.env.BEPOLIA_RPC_URL || "",
    //   wsUrl: process.env.BEPOLIA_WS_URL || "",
    //   chainId: parseInt(process.env.BEPOLIA_CHAIN_ID || "11155111", 10),
    //   blockConfirmations: parseInt(
    //     process.env.BEPOLIA_BLOCK_CONFIRMATIONS || "2",
    //     10
    //   ),
    //   startBlock: process.env.BEPOLIA_START_BLOCK
    //     ? parseInt(process.env.BEPOLIA_START_BLOCK, 10)
    //     : undefined,
    // },
  },
  healthCheckInterval: parseInt(
    process.env.HEALTH_CHECK_INTERVAL || "30000",
    10
  ),
  retryDelay: parseInt(process.env.RETRY_DELAY || "300", 10),
  maxRetries: parseInt(process.env.MAX_RETRIES || "5", 10),
  indexingBatchSize: parseInt(process.env.INDEXING_BATCH_SIZE || "100", 10),
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432", 10),
    username: process.env.DB_USERNAME || "postgres",
    password: process.env.DB_PASSWORD || "postgres",
    name: process.env.DB_NAME || "blockchain_indexer",
    logging: process.env.DB_LOGGING === "true",
    ssl: process.env.DB_SSL === "true",
  },
};

export default config;
