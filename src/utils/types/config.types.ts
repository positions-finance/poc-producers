export interface BlockchainConfig {
  rpcUrl: string;
  wsUrl: string;
  chainId: number;
  blockConfirmations: number;
  startBlock?: number;
}

export interface KafkaConfig {
  clientId: string;
  brokers: string[];
  topic: string;
}

export interface ChainConfigs {
  [chainName: string]: BlockchainConfig;
}

export interface ApiConfig {
  port: number;
  host: string;
}

export interface EnvConfig {
  nodeEnv: string;
  logLevel: string;
  api: ApiConfig;
  kafka: KafkaConfig;
  chains: ChainConfigs;
  healthCheckInterval: number; // in milliseconds
  retryDelay: number; // in milliseconds
  maxRetries: number;
  indexingBatchSize: number;
  database: DatabaseConfig;
}

export interface DatabaseConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  name: string;
  logging: boolean;
  ssl: boolean;
}
