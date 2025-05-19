import { Block, TransactionResponse, TransactionReceipt } from "ethers";

export interface FilteredTransaction extends Partial<TransactionResponse> {
  blockHash: string;
  blockNumber: number;
  topics?: string[];
  chainId: bigint;
  chainName: string;
}

export interface ProcessedBlock {
  blockHash: string;
  blockNumber: number;
  timestamp: number;
  transactions: FilteredTransaction[];
  chainId: number;
  chainName: string;
}

export interface TopicFilter {
  hash: string;
  description?: string;
}

export interface IndexerStatus {
  chainName: string;
  chainId: number;
  latestBlock: number;
  processedBlock: number;
  isHealthy: boolean;
  lastUpdated: Date;
  isPaused: boolean;
}

export interface BlockchainMessage {
  transaction: FilteredTransaction;
  timestamp: number;
  topics: string[];
}

export interface BlockchainProvider {
  getLatestBlock(): Promise<number>;
  getBlock(blockNumber: number): Promise<Block | null>;
  getBlockWithTransactions(blockNumber: number): Promise<Block | null>;
  getChainId(): Promise<number>;
  isHealthy(): Promise<boolean>;
  subscribeToNewBlocks(callback: (blockNumber: number) => void): void;
  unsubscribeFromNewBlocks(): void;
  getChainName(): string;
  getTransactionReceipt(txHash: string): Promise<TransactionReceipt | null>;
}

export interface IndexerParams {
  chainName: string;
  provider: BlockchainProvider;
  topicFilters: TopicFilter[];
  startBlock?: number;
  blockConfirmations: number;
}

export interface EventsProcessor {
  processBlock(block: Block): Promise<ProcessedBlock>;
  filterTransactionsByTopics(
    transactions: string[],
    topics: TopicFilter[]
  ): Promise<FilteredTransaction[]>;
}
