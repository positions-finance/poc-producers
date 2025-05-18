import { BlockchainIndexer } from "../utils/types/indexer.types";
import {
  BlockchainProvider,
  TopicFilter,
} from "../utils/types/blockchain.types";
import { KafkaProducer } from "../utils/types/kafka.types";
import BlockchainIndexerImpl from "../services/indexer.service";
import logger from "../utils/logger";

/**
 * Factory for creating blockchain indexers
 */
export class BlockchainIndexerFactory {
  /**
   * Creates a new blockchain indexer
   * @param provider - Blockchain provider for the specific chain
   * @param producer - Kafka producer to output messages
   * @param chainName - Name of the blockchain
   * @param topicFilters - Initial topic filters to apply
   * @param startBlock - Starting block number for indexing (optional)
   * @param blockConfirmations - Number of block confirmations to wait before processing
   * @returns BlockchainIndexer instance
   */
  static createIndexer(
    provider: BlockchainProvider,
    producer: KafkaProducer,
    chainName: string,
    topicFilters: TopicFilter[] = [],
    startBlock?: number,
    blockConfirmations?: number
  ): BlockchainIndexer {
    logger.info("Creating blockchain indexer", {
      chainName,
      topicFilters: topicFilters.length,
      startBlock,
      blockConfirmations,
    });

    return new BlockchainIndexerImpl(
      provider,
      producer,
      chainName,
      topicFilters,
      startBlock,
      blockConfirmations
    );
  }
}

export default BlockchainIndexerFactory;
