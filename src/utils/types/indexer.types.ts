import {
  BlockchainProvider,
  IndexerStatus,
  TopicFilter,
} from "./blockchain.types";
import { KafkaProducer } from "./kafka.types";

export interface BlockchainIndexer {
  start(): Promise<void>;

  stop(): Promise<void>;

  pause(): Promise<void>;

  resume(): Promise<void>;

  getStatus(): IndexerStatus;

  processBlockNumber(blockNumber: number): Promise<void>;

  processBlockRange(startBlock: number, endBlock: number): Promise<void>;

  addTopicFilter(filter: TopicFilter): void;

  removeTopicFilter(topicHash: string): void;

  getTopicFilters(): TopicFilter[];

  setRetryDelay(milliseconds: number): void;

  setMaxRetries(count: number): void;
}

export interface BlockchainIndexerFactory {
  createIndexer(
    provider: BlockchainProvider,
    producer: KafkaProducer,
    chainName: string,
    topicFilters: TopicFilter[],
    startBlock?: number,
    blockConfirmations?: number
  ): BlockchainIndexer;
}
