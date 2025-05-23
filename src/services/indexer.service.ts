import {
  BlockchainProvider,
  BlockchainMessage,
  TopicFilter,
  IndexerStatus,
} from "../utils/types/blockchain.types";
import { RedisPublisher } from "../utils/types/redis.types";
import BlockchainEventsProcessor from "./events.service";
import { UnprocessedBlocksService } from "./unprocessed-blocks.service";
import { ProcessedBlocksService } from "./processed-blocks.service";
import logger from "../utils/logger";
import config from "../config/env";
import { BlockchainIndexer } from "../utils/types/indexer.types";

/**
 * Implementation of the blockchain indexer
 * Handles indexing blocks from a blockchain and publishing messages to Redis
 */
export default class BlockchainIndexerImpl implements BlockchainIndexer {
  private topicFilters: TopicFilter[] = [];
  private latestBlock: number = 0;
  private processedBlock: number = 0;
  private isRunning: boolean = false;
  private isPaused: boolean = false;
  private retryDelay: number;
  private maxRetries: number;
  private eventsProcessor!: BlockchainEventsProcessor;
  private blockConfirmations: number;
  private lastUpdated: Date = new Date();
  private healthCheckTimer: NodeJS.Timeout | null = null;
  private blockSubscriptionActive: boolean = false;

  /**
   * Creates a new blockchain indexer
   * @param provider - Blockchain provider for the specific chain
   * @param publisher - Redis publisher for outputting filtered transactions
   * @param chainName - Name of the blockchain
   * @param unprocessedBlocksService - Service for unprocessed blocks
   * @param processedBlocksService - Service for processed blocks
   * @param initialTopicFilters - Initial topic filters to apply
   * @param startBlock - Starting block number for indexing (optional)
   * @param blockConfirmations - Number of block confirmations to wait before processing
   */
  constructor(
    private provider: BlockchainProvider,
    private publisher: RedisPublisher,
    private chainName: string,
    private unprocessedBlocksService: UnprocessedBlocksService,
    private processedBlocksService: ProcessedBlocksService,
    initialTopicFilters: TopicFilter[] = [],
    startBlock?: number,
    blockConfirmations?: number
  ) {
    this.topicFilters = [...initialTopicFilters];
    this.retryDelay = config.retryDelay;
    this.maxRetries = config.maxRetries;
    this.blockConfirmations = blockConfirmations || 2;

    if (startBlock !== undefined) {
      this.processedBlock = startBlock - 1;
    }

    this.initializeEventsProcessor();

    logger.info("Blockchain indexer created", {
      chainName,
      topicFilters: this.topicFilters.length,
      startBlock,
      blockConfirmations: this.blockConfirmations,
    });
  }

  /**
   * Initialize the events processor
   */
  private async initializeEventsProcessor(): Promise<void> {
    try {
      const chainId = await this.provider.getChainId();
      this.eventsProcessor = new BlockchainEventsProcessor(
        this.chainName,
        chainId,
        this.provider
      );

      logger.info("Events processor initialized", {
        chainName: this.chainName,
        chainId,
      });
    } catch (error) {
      logger.error("Failed to initialize events processor", {
        chainName: this.chainName,
        error,
      });
      throw error;
    }
  }

  /**
   * Start the indexer
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn("Indexer is already running", { chainName: this.chainName });
      return;
    }

    try {
      logger.info("Starting blockchain indexer", { chainName: this.chainName });

      if (!this.publisher.isConnected()) {
        await this.publisher.connect();
      }

      this.isRunning = true;
      this.isPaused = false;

      this.latestBlock = await this.provider.getLatestBlock();

      if (this.processedBlock === 0) {
        this.processedBlock = Math.max(
          0,
          this.latestBlock - this.blockConfirmations
        );
        logger.info("Starting indexing from block", {
          chainName: this.chainName,
          startBlock: this.processedBlock,
        });
      }

      this.startHealthCheck();

      this.subscribeToNewBlocks();

      this.processBacklog();

      logger.info("Blockchain indexer started successfully", {
        chainName: this.chainName,
        latestBlock: this.latestBlock,
        processedBlock: this.processedBlock,
      });
    } catch (error) {
      this.isRunning = false;
      logger.error("Failed to start blockchain indexer", {
        chainName: this.chainName,
        error,
      });
      throw error;
    }
  }

  /**
   * Stop the indexer
   */
  async stop(): Promise<void> {
    logger.info("Stopping blockchain indexer", { chainName: this.chainName });

    this.unsubscribeFromNewBlocks();

    this.stopHealthCheck();

    this.isRunning = false;
    this.isPaused = false;

    if (this.publisher.isConnected()) {
      await this.publisher.disconnect();
    }

    logger.info("Blockchain indexer stopped", { chainName: this.chainName });
  }

  /**
   * Pause the indexer
   */
  async pause(): Promise<void> {
    if (!this.isRunning || this.isPaused) {
      logger.warn("Indexer is already paused or not running", {
        chainName: this.chainName,
      });
      return;
    }

    logger.info("Pausing blockchain indexer", { chainName: this.chainName });
    this.isPaused = true;
  }

  /**
   * Resume the indexer
   */
  async resume(): Promise<void> {
    if (!this.isRunning || !this.isPaused) {
      logger.warn("Indexer is not paused or not running", {
        chainName: this.chainName,
      });
      return;
    }

    logger.info("Resuming blockchain indexer", { chainName: this.chainName });
    this.isPaused = false;

    this.processBacklog();
  }

  /**
   * Get the current status of the indexer
   */
  getStatus(): IndexerStatus {
    return {
      chainName: this.chainName,
      chainId: this.eventsProcessor ? this.eventsProcessor["chainId"] : 0,
      latestBlock: this.latestBlock,
      processedBlock: this.processedBlock,
      isHealthy: this.isRunning && !this.isPaused,
      lastUpdated: this.lastUpdated,
      isPaused: this.isPaused,
    };
  }

  /**
   * Process a specific block number
   * @param blockNumber - The block number to process
   */
  async processBlockNumber(blockNumber: number): Promise<void> {
    logger.info("Processing specific block", {
      chainName: this.chainName,
      blockNumber,
    });

    try {
      const chainId = await this.provider.getChainId();

      const isProcessed = await this.processedBlocksService.isBlockProcessed(
        chainId,
        blockNumber
      );
      if (isProcessed) {
        logger.debug("Block already processed", {
          chainName: this.chainName,
          blockNumber,
        });
        return;
      }

      const block = await this.provider.getBlockWithTransactions(blockNumber);

      if (!block) {
        logger.warn("Block not found", {
          chainName: this.chainName,
          blockNumber,
        });
        return;
      }

      const unprocessedBlock = await this.unprocessedBlocksService.addBlock(
        chainId,
        block
      );

      await this.unprocessedBlocksService.checkForReorgs(chainId, block);

      await this.unprocessedBlocksService.markAsProcessing(unprocessedBlock);

      const processedBlock = await this.eventsProcessor.processBlock(
        block,
        this.topicFilters
      );
      logger.info("Processed block", {
        chainName: this.chainName,
        blockNumber,
        processedBlock,
        transactions: processedBlock.transactions.length,
      });

      if (processedBlock.transactions.length > 0) {
        const messages: BlockchainMessage[] = processedBlock.transactions.map(
          (tx) => ({
            transaction: tx,
            timestamp: processedBlock.timestamp,
            topics: tx.topics || [],
          })
        );

        await this.publisher.publishMessages(messages);

        logger.info("Produced messages for block", {
          chainName: this.chainName,
          blockNumber,
          messageCount: messages.length,
        });
      }

      await this.unprocessedBlocksService.markAsCompleted(unprocessedBlock);

      await this.processedBlocksService.addBlock(chainId, block);

      this.lastUpdated = new Date();
    } catch (error) {
      logger.error("Error processing block", {
        chainName: this.chainName,
        blockNumber,
        error,
      });

      const unprocessedBlock = await this.unprocessedBlocksService
        .getBlocksToProcess(await this.provider.getChainId(), 1)
        .then((blocks) => blocks.find((b) => b.blockNumber === blockNumber));

      if (unprocessedBlock) {
        await this.unprocessedBlocksService.markAsFailed(
          unprocessedBlock,
          error as Error
        );
      }

      throw error;
    }
  }

  /**
   * Process a range of blocks
   * @param startBlock - The starting block number
   * @param endBlock - The ending block number
   */
  async processBlockRange(startBlock: number, endBlock: number): Promise<void> {
    logger.info("Processing block range", {
      chainName: this.chainName,
      startBlock,
      endBlock,
      count: endBlock - startBlock + 1,
    });

    const batchSize = config.indexingBatchSize;

    for (let i = startBlock; i <= endBlock; i += batchSize) {
      if (!this.isRunning || this.isPaused) {
        logger.info("Block range processing interrupted", {
          chainName: this.chainName,
          currentBlock: i,
        });
        break;
      }

      const batchEnd = Math.min(i + batchSize - 1, endBlock);

      const promises = [];
      for (let j = i; j <= batchEnd; j++) {
        promises.push(this.processBlockNumberWithRetry(j));
      }

      await Promise.all(promises);

      logger.info("Processed batch of blocks", {
        chainName: this.chainName,
        from: i,
        to: batchEnd,
      });
    }

    logger.info("Block range processing completed", {
      chainName: this.chainName,
      startBlock,
      endBlock,
    });
  }

  /**
   * Process a block with retry logic
   * @param blockNumber - The block number to process
   */
  private async processBlockNumberWithRetry(
    blockNumber: number
  ): Promise<void> {
    let retries = 0;

    while (retries < this.maxRetries) {
      try {
        await this.processBlockNumber(blockNumber);
        return;
      } catch (error) {
        retries++;

        if (retries >= this.maxRetries) {
          logger.error("Max retries reached for processing block", {
            chainName: this.chainName,
            blockNumber,
            retries,
          });
          throw error;
        }

        logger.warn("Retrying block processing", {
          chainName: this.chainName,
          blockNumber,
          retry: retries,
          maxRetries: this.maxRetries,
        });

        await new Promise((resolve) => setTimeout(resolve, this.retryDelay));
      }
    }
  }

  /**
   * Process backlog of blocks
   */
  private async processBacklog(): Promise<void> {
    if (!this.isRunning || this.isPaused) {
      logger.debug(
        "Skipping backlog processing - indexer not running or paused",
        {
          chainName: this.chainName,
          isRunning: this.isRunning,
          isPaused: this.isPaused,
        }
      );
      return;
    }

    try {
      this.latestBlock = await this.provider.getLatestBlock();
      const chainId = await this.provider.getChainId();

      const confirmedBlock = Math.max(
        0,
        this.latestBlock - this.blockConfirmations
      );

      const latestProcessed =
        await this.processedBlocksService.getLatestProcessedBlock(chainId);
      const startBlock = latestProcessed
        ? latestProcessed.blockNumber + 1
        : this.processedBlock + 1;

      logger.debug("Checking backlog status", {
        chainName: this.chainName,
        startBlock,
        latestBlock: this.latestBlock,
        confirmedBlock,
        blockConfirmations: this.blockConfirmations,
      });

      if (startBlock > confirmedBlock) {
        logger.debug("No new blocks to process", {
          chainName: this.chainName,
          startBlock,
          confirmedBlock,
        });
        return;
      }

      await this.processBlockRange(startBlock, confirmedBlock);

      this.lastUpdated = new Date();

      logger.info("Backlog processing completed", {
        chainName: this.chainName,
        startBlock,
        latestBlock: this.latestBlock,
        confirmedBlock,
      });
    } catch (error) {
      logger.error("Error processing backlog", {
        chainName: this.chainName,
        error,
      });
    }
  }

  /**
   * Subscribe to new blocks from the blockchain
   */
  private subscribeToNewBlocks(): void {
    if (this.blockSubscriptionActive) {
      return;
    }

    this.provider.subscribeToNewBlocks(async (blockNumber: number) => {
      if (!this.isRunning || this.isPaused) {
        return;
      }

      logger.debug("New block notification received", {
        chainName: this.chainName,
        blockNumber,
      });

      this.latestBlock = Math.max(this.latestBlock, blockNumber);

      this.processBacklog();
    });

    this.blockSubscriptionActive = true;

    logger.info("Subscribed to new blocks", { chainName: this.chainName });
  }

  /**
   * Unsubscribe from new blocks
   */
  private unsubscribeFromNewBlocks(): void {
    if (!this.blockSubscriptionActive) {
      return;
    }

    this.provider.unsubscribeFromNewBlocks();
    this.blockSubscriptionActive = false;

    logger.info("Unsubscribed from new blocks", { chainName: this.chainName });
  }

  /**
   * Start periodic health check
   */
  private startHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }

    this.healthCheckTimer = setInterval(async () => {
      try {
        const providerHealthy = await this.provider.isHealthy();

        const publisherHealthy = this.publisher.isConnected();

        logger.debug("Health check", {
          chainName: this.chainName,
          providerHealthy,
          publisherHealthy,
          latestBlock: this.latestBlock,
          processedBlock: this.processedBlock,
        });

        if (!providerHealthy || !publisherHealthy) {
          logger.warn("Unhealthy state detected", {
            chainName: this.chainName,
            providerHealthy,
            publisherHealthy,
          });

          if (!publisherHealthy && this.isRunning) {
            try {
              await this.publisher.connect();
              logger.info("Reconnected Redis publisher", {
                chainName: this.chainName,
              });
            } catch (error) {
              logger.error("Failed to reconnect Redis publisher", {
                chainName: this.chainName,
                error,
              });
            }
          }
        }
      } catch (error) {
        logger.error("Error during health check", {
          chainName: this.chainName,
          error,
        });
      }
    }, config.healthCheckInterval);

    logger.info("Started health check", {
      chainName: this.chainName,
      interval: config.healthCheckInterval,
    });
  }

  /**
   * Stop periodic health check
   */
  private stopHealthCheck(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
      this.healthCheckTimer = null;

      logger.info("Stopped health check", { chainName: this.chainName });
    }
  }

  /**
   * Add a new topic filter
   * @param filter - The topic filter to add
   */
  addTopicFilter(filter: TopicFilter): void {
    const exists = this.topicFilters.some(
      (f) => f.hash.toLowerCase() === filter.hash.toLowerCase()
    );

    if (!exists) {
      this.topicFilters.push({
        hash: filter.hash.toLowerCase(),
        description: filter.description,
      });

      logger.info("Added topic filter", {
        chainName: this.chainName,
        hash: filter.hash,
        description: filter.description,
        totalFilters: this.topicFilters.length,
      });
    }
  }

  /**
   * Remove a topic filter
   * @param topicHash - The topic hash to remove
   */
  removeTopicFilter(topicHash: string): void {
    const initialLength = this.topicFilters.length;

    this.topicFilters = this.topicFilters.filter(
      (filter) => filter.hash.toLowerCase() !== topicHash.toLowerCase()
    );

    if (initialLength !== this.topicFilters.length) {
      logger.info("Removed topic filter", {
        chainName: this.chainName,
        hash: topicHash,
        totalFilters: this.topicFilters.length,
      });
    }
  }

  /**
   * Get all current topic filters
   */
  getTopicFilters(): TopicFilter[] {
    return [...this.topicFilters];
  }

  /**
   * Set the delay between retries for failed operations
   * @param milliseconds - Retry delay in milliseconds
   */
  setRetryDelay(milliseconds: number): void {
    this.retryDelay = milliseconds;
    logger.info("Set retry delay", {
      chainName: this.chainName,
      retryDelay: milliseconds,
    });
  }

  /**
   * Set maximum number of retries for operations
   * @param count - Maximum retry count
   */
  setMaxRetries(count: number): void {
    this.maxRetries = count;
    logger.info("Set max retries", {
      chainName: this.chainName,
      maxRetries: count,
    });
  }
}
