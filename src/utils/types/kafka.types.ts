import { BlockchainMessage } from "./blockchain.types";

export interface KafkaProducer {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  produceMessage(message: BlockchainMessage): Promise<void>;
  produceMessages(messages: BlockchainMessage[]): Promise<void>;
  isConnected(): boolean;
  getStatus(): KafkaProducerStatus;
}

export interface KafkaProducerStatus {
  isConnected: boolean;
  messagesProduced: number;
  lastMessageTimestamp?: Date;
  errors: number;
  retries: number;
}

export interface KafkaProducerFactory {
  createProducer(
    clientId: string,
    brokers: string[],
    topic: string
  ): KafkaProducer;
}
