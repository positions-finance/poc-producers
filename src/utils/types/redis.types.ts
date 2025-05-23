import { BlockchainMessage } from "./blockchain.types";

export interface RedisPublisher {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  publishMessage(message: BlockchainMessage): Promise<void>;
  publishMessages(messages: BlockchainMessage[]): Promise<void>;
  isConnected(): boolean;
  getStatus(): RedisPublisherStatus;
}

export interface RedisPublisherStatus {
  isConnected: boolean;
  messagesPublished: number;
  lastMessageTimestamp?: Date;
  errors: number;
  retries: number;
}

export interface RedisPublisherFactory {
  createPublisher(
    host: string,
    port: number,
    channel: string,
    options?: RedisConnectionOptions
  ): RedisPublisher;
}

export interface RedisConnectionOptions {
  password?: string;
  database?: number;
  username?: string;
  tls?: boolean;
  retryDelayOnFailover?: number;
  enableReadyCheck?: boolean;
  maxRetriesPerRequest?: number;
}
