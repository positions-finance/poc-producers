import { createClient, RedisClientType } from "redis";
import {
  RedisPublisher,
  RedisPublisherStatus,
  RedisConnectionOptions,
} from "../utils/types/redis.types";
import { BlockchainMessage } from "../utils/types/blockchain.types";
import logger from "../utils/logger";

/**
 * Implementation of the RedisPublisher interface using Redis client
 */
export default class RedisPublisherImpl implements RedisPublisher {
  private client: RedisClientType;
  private channel: string;
  private connected: boolean = false;
  private messagesPublished: number = 0;
  private lastMessageTimestamp?: Date;
  private errors: number = 0;
  private retries: number = 0;

  /**
   * Creates a new Redis publisher
   * @param host - Redis server host
   * @param port - Redis server port
   * @param channel - Channel to publish messages to
   * @param options - Additional Redis connection options
   */
  constructor(
    private host: string,
    private port: number,
    channel: string,
    private options?: RedisConnectionOptions
  ) {
    this.channel = channel;

    const redisConfig: any = {
      socket: {
        host: this.host,
        port: this.port,
        tls: this.options?.tls || false,
      },
      database: this.options?.database || 0,
    };

    if (this.options?.password) {
      redisConfig.password = this.options.password;
    }

    if (this.options?.username) {
      redisConfig.username = this.options.username;
    }

    this.client = createClient(redisConfig);

    // Set up event handlers
    this.client.on("connect", () => {
      logger.info("Redis publisher connecting", { host, port, channel });
    });

    this.client.on("ready", () => {
      logger.info("Redis publisher connected and ready", {
        host,
        port,
        channel,
      });
      this.connected = true;
    });

    this.client.on("end", () => {
      logger.warn("Redis publisher connection ended", { host, port, channel });
      this.connected = false;
    });

    this.client.on("error", (error: Error) => {
      logger.error("Redis publisher error", { host, port, channel, error });
      this.errors++;
      this.connected = false;
    });

    this.client.on("reconnecting", () => {
      logger.info("Redis publisher reconnecting", { host, port, channel });
      this.retries++;
    });
  }

  /**
   * Connect to Redis server
   */
  async connect(): Promise<void> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      logger.info("Redis publisher connected successfully", {
        host: this.host,
        port: this.port,
        channel: this.channel,
      });
    } catch (error) {
      logger.error("Failed to connect Redis publisher", {
        host: this.host,
        port: this.port,
        error,
      });
      this.errors++;
      throw error;
    }
  }

  /**
   * Disconnect from Redis server
   */
  async disconnect(): Promise<void> {
    try {
      if (this.client.isOpen) {
        await this.client.disconnect();
      }
      logger.info("Redis publisher disconnected successfully", {
        host: this.host,
        port: this.port,
      });
      this.connected = false;
    } catch (error) {
      logger.error("Failed to disconnect Redis publisher", {
        host: this.host,
        port: this.port,
        error,
      });
      this.errors++;
      throw error;
    }
  }

  /**
   * Publish a single message to Redis
   * @param message - Blockchain message to publish
   */
  async publishMessage(message: BlockchainMessage): Promise<void> {
    if (!this.connected || !this.client.isOpen) {
      logger.warn(
        "Attempting to publish message while disconnected, reconnecting",
        {
          host: this.host,
          port: this.port,
        }
      );
      await this.connect();
    }

    try {
      const messageData = {
        ...message,
        metadata: {
          chainId: message.transaction.chainId,
          chainName: message.transaction.chainName,
          blockNumber: message.transaction.blockNumber,
          transactionHash: message.transaction.hash,
          timestamp: message.timestamp,
        },
      };

      await this.client.publish(this.channel, JSON.stringify(messageData));

      this.messagesPublished++;
      this.lastMessageTimestamp = new Date();

      logger.debug("Message published successfully", {
        host: this.host,
        port: this.port,
        channel: this.channel,
        transactionHash: message.transaction.hash,
      });
    } catch (error) {
      this.errors++;
      logger.error("Failed to publish message", {
        host: this.host,
        port: this.port,
        channel: this.channel,
        error,
      });
      throw error;
    }
  }

  /**
   * Publish multiple messages to Redis in sequence
   * @param messages - Array of blockchain messages to publish
   */
  async publishMessages(messages: BlockchainMessage[]): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    if (!this.connected || !this.client.isOpen) {
      logger.warn(
        "Attempting to publish messages while disconnected, reconnecting",
        {
          host: this.host,
          port: this.port,
        }
      );
      await this.connect();
    }

    try {
      // Use pipeline for better performance when publishing multiple messages
      const pipeline = this.client.multi();

      messages.forEach((message) => {
        const messageData = {
          ...message,
          metadata: {
            chainId: message.transaction.chainId,
            chainName: message.transaction.chainName,
            blockNumber: message.transaction.blockNumber,
            transactionHash: message.transaction.hash,
            timestamp: message.timestamp,
          },
        };
        pipeline.publish(this.channel, JSON.stringify(messageData));
      });

      await pipeline.exec();

      this.messagesPublished += messages.length;
      this.lastMessageTimestamp = new Date();

      logger.info("Batch messages published successfully", {
        host: this.host,
        port: this.port,
        channel: this.channel,
        count: messages.length,
      });
    } catch (error) {
      this.errors++;
      this.retries++;

      logger.error("Failed to publish batch messages", {
        host: this.host,
        port: this.port,
        channel: this.channel,
        count: messages.length,
        error,
      });

      throw error;
    }
  }

  /**
   * Check if the publisher is connected
   */
  isConnected(): boolean {
    return this.connected && this.client.isOpen;
  }

  /**
   * Get the current status of the publisher
   */
  getStatus(): RedisPublisherStatus {
    return {
      isConnected: this.connected && this.client.isOpen,
      messagesPublished: this.messagesPublished,
      lastMessageTimestamp: this.lastMessageTimestamp,
      errors: this.errors,
      retries: this.retries,
    };
  }
}
