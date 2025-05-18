import { Kafka, Producer, CompressionTypes } from "kafkajs";
import { KafkaProducer, KafkaProducerStatus } from "../utils/types/kafka.types";
import { BlockchainMessage } from "../utils/types/blockchain.types";
import logger from "../utils/logger";

/**
 * Implementation of the KafkaProducer interface using KafkaJS
 */
export default class KafkaJsProducer implements KafkaProducer {
  private kafka: Kafka;
  private producer: Producer;
  private topic: string;
  private connected: boolean = false;
  private messagesProduced: number = 0;
  private lastMessageTimestamp?: Date;
  private errors: number = 0;
  private retries: number = 0;

  /**
   * Creates a new KafkaJS producer
   * @param clientId - Client ID for Kafka producer
   * @param brokers - Array of Kafka broker URLs
   * @param topic - Topic to produce messages to
   */
  constructor(
    private clientId: string,
    private brokers: string[],
    topic: string
  ) {
    this.topic = topic;
    this.kafka = new Kafka({
      clientId,
      brokers,
      retry: {
        initialRetryTime: 300,
        retries: 5,
      },
    });
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000,
    });

    this.producer.on("producer.connect", () => {
      logger.info("Kafka producer connected", { clientId, topic });
      this.connected = true;
    });

    this.producer.on("producer.disconnect", () => {
      logger.warn("Kafka producer disconnected", { clientId, topic });
      this.connected = false;
    });

    this.producer.on("producer.network.request_timeout", (payload) => {
      logger.error("Kafka producer network timeout", {
        clientId,
        topic,
        payload,
      });
      this.errors++;
    });
  }

  /**
   * Connect to Kafka brokers
   */
  async connect(): Promise<void> {
    try {
      await this.producer.connect();
      logger.info("Kafka producer connected successfully", {
        clientId: this.clientId,
        brokers: this.brokers,
      });
    } catch (error) {
      logger.error("Failed to connect Kafka producer", {
        clientId: this.clientId,
        error,
      });
      this.errors++;
      throw error;
    }
  }

  /**
   * Disconnect from Kafka brokers
   */
  async disconnect(): Promise<void> {
    try {
      await this.producer.disconnect();
      logger.info("Kafka producer disconnected successfully", {
        clientId: this.clientId,
      });
      this.connected = false;
    } catch (error) {
      logger.error("Failed to disconnect Kafka producer", {
        clientId: this.clientId,
        error,
      });
      this.errors++;
      throw error;
    }
  }

  /**
   * Produce a single message to Kafka
   * @param message - Blockchain message to produce
   */
  async produceMessage(message: BlockchainMessage): Promise<void> {
    if (!this.connected) {
      logger.warn(
        "Attempting to produce message while disconnected, reconnecting",
        {
          clientId: this.clientId,
        }
      );
      await this.connect();
    }

    try {
      await this.producer.send({
        topic: this.topic,
        compression: CompressionTypes.GZIP,
        messages: [
          {
            key: `${message.transaction.chainId}-${message.transaction.blockNumber}-${message.transaction.hash}`,
            value: JSON.stringify(message),
            headers: {
              "chain-id": message.transaction.chainId.toString(),
              "chain-name": message.transaction.chainName,
              "block-number": message.transaction.blockNumber.toString(),
              timestamp: message.timestamp.toString(),
            },
          },
        ],
      });

      this.messagesProduced++;
      this.lastMessageTimestamp = new Date();

      logger.debug("Message produced successfully", {
        clientId: this.clientId,
        topic: this.topic,
        transactionHash: message.transaction.hash,
      });
    } catch (error) {
      this.errors++;
      logger.error("Failed to produce message", {
        clientId: this.clientId,
        topic: this.topic,
        error,
      });
      throw error;
    }
  }

  /**
   * Produce multiple messages to Kafka in batch
   * @param messages - Array of blockchain messages to produce
   */
  async produceMessages(messages: BlockchainMessage[]): Promise<void> {
    if (messages.length === 0) {
      return;
    }

    if (!this.connected) {
      logger.warn(
        "Attempting to produce messages while disconnected, reconnecting",
        {
          clientId: this.clientId,
        }
      );
      await this.connect();
    }

    try {
      await this.producer.send({
        topic: this.topic,
        compression: CompressionTypes.GZIP,
        messages: messages.map((message) => ({
          key: `${message.transaction.chainId}-${message.transaction.blockNumber}-${message.transaction.hash}`,
          value: JSON.stringify(message),
          headers: {
            "chain-id": message.transaction.chainId.toString(),
            "chain-name": message.transaction.chainName,
            "block-number": message.transaction.blockNumber.toString(),
            timestamp: message.timestamp.toString(),
          },
        })),
      });

      this.messagesProduced += messages.length;
      this.lastMessageTimestamp = new Date();

      logger.info("Batch messages produced successfully", {
        clientId: this.clientId,
        topic: this.topic,
        count: messages.length,
      });
    } catch (error) {
      this.errors++;
      this.retries++;

      logger.error("Failed to produce batch messages", {
        clientId: this.clientId,
        topic: this.topic,
        count: messages.length,
        error,
      });

      throw error;
    }
  }

  /**
   * Check if the producer is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get the current status of the producer
   */
  getStatus(): KafkaProducerStatus {
    return {
      isConnected: this.connected,
      messagesProduced: this.messagesProduced,
      lastMessageTimestamp: this.lastMessageTimestamp,
      errors: this.errors,
      retries: this.retries,
    };
  }
}
