import { Block, Log } from "ethers";
import {
  EventsProcessor,
  FilteredTransaction,
  ProcessedBlock,
  TopicFilter,
  BlockchainProvider,
} from "../utils/types/blockchain.types";
import logger from "../utils/logger";

/**
 * Implementation of blockchain events processor
 * Responsible for filtering transactions based on topic0 hashes
 */
export default class BlockchainEventsProcessor implements EventsProcessor {
  /**
   * Constructor
   * @param chainName - Name of the blockchain
   * @param chainId - Chain ID of the blockchain
   * @param provider - Blockchain provider instance
   */
  constructor(
    private chainName: string,
    private chainId: number,
    private provider: BlockchainProvider
  ) {
    logger.info("Initialized blockchain events processor", {
      chainName,
      chainId,
    });
  }

  /**
   * Process a block and filter transactions based on configured topic filters
   * @param block - The block to process with transactions
   * @param topicFilters - Array of topic filters to apply
   */
  async processBlock(
    block: Block,
    topicFilters: TopicFilter[] = []
  ): Promise<ProcessedBlock> {
    logger.debug("Processing block", {
      chainName: this.chainName,
      blockNumber: block.number,
      transactionCount: block.transactions?.length || 0,
    });

    if (!block.transactions || !Array.isArray(block.transactions)) {
      logger.warn("Block does not contain transactions array", {
        chainName: this.chainName,
        blockNumber: block.number,
      });

      return {
        blockHash: block.hash || "",
        blockNumber: Number(block.number) || 0,
        timestamp: Number(block.timestamp) || 0,
        transactions: [],
        chainId: this.chainId,
        chainName: this.chainName,
      };
    }

    const filteredTransactions = await this.filterTransactionsByTopics(
      block.transactions,
      topicFilters
    );

    logger.info("Block processed", {
      chainName: this.chainName,
      blockNumber: block.number,
      totalTransactions: block.transactions.length,
      filteredTransactions: filteredTransactions.length,
    });

    return {
      blockHash: block.hash || "",
      blockNumber: Number(block.number) || 0,
      timestamp: Number(block.timestamp) || 0,
      transactions: filteredTransactions,
      chainId: this.chainId,
      chainName: this.chainName,
    };
  }

  /**
   * Filter transactions by topic0 hashes
   * @param transactions - Array of transactions to filter
   * @param topicFilters - Array of topic filters to apply
   */
  async filterTransactionsByTopics(
    transactions: string[],
    topicFilters: TopicFilter[]
  ): Promise<FilteredTransaction[]> {
    if (!topicFilters.length) {
      return [];
    }

    const topicHashSet = new Set(
      topicFilters.map((filter) => filter.hash.toLowerCase())
    );

    const filteredTransactions: FilteredTransaction[] = [];

    for (const tx of transactions) {
      try {
        const receipt = await this.provider.getTransactionReceipt(tx);

        if (!receipt || !receipt.logs || !Array.isArray(receipt.logs)) {
          continue;
        }

        const matchingTopics: string[] = [];

        for (const log of receipt.logs as Log[]) {
          if (log.topics && log.topics.length > 0) {
            const topic0 = log.topics[0].toLowerCase();

            if (topicHashSet.has(topic0)) {
              matchingTopics.push(topic0);
            }
          }
        }

        if (matchingTopics.length > 0) {
          const transaction = await this.provider.getTransaction(tx);

          const filteredTx: FilteredTransaction = {
            blockHash: receipt.blockHash || "",
            blockNumber: receipt.blockNumber || 0,
            topics: matchingTopics,
            chainId: this.chainId,
            chainName: this.chainName,
            hash: receipt.hash || "",
            from: receipt.from || "",
            to: receipt.to || undefined,
            value: transaction?.value?.toString() || "0",
            data: transaction?.data || "",
            gasUsed: receipt.gasUsed?.toString(),
            gasPrice: transaction?.gasPrice?.toString(),
            status: receipt.status?.toString() || "1",
            logs: receipt.logs || [],
          };

          filteredTransactions.push(filteredTx);

          logger.debug("Matched transaction", {
            hash: tx,
            topics: matchingTopics,
            chainName: this.chainName,
          });
        }
      } catch (error) {
        logger.error("Error processing transaction", {
          hash: tx,
          error,
          chainName: this.chainName,
        });
      }
    }

    return filteredTransactions;
  }
}
