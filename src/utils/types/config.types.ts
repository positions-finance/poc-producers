export interface BlockchainConfig {
  rpcUrl: string;
  wsUrl: string;
  chainId: number;
  blockConfirmations: number;
  startBlock?: number;
}

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  database?: number;
  channel: string;
  username?: string;
  tls?: boolean;
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
  redis: RedisConfig;
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
