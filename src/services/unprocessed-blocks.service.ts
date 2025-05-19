import { LessThan, MoreThanOrEqual, Repository } from "typeorm";
import {
  UnprocessedBlock,
  BlockProcessingStatus,
} from "../entities/UnprocessedBlock.entity";
import { Block } from "ethers";
import logger from "../utils/logger";
import { BlockchainProvider } from "../utils/types/blockchain.types";

export class UnprocessedBlocksService {
  private readonly MAX_RETRIES = 5;
  private readonly REORG_DEPTH = 10;
  constructor(
    private repository: Repository<UnprocessedBlock>,
    private provider: BlockchainProvider
  ) {}

  /**
   * Add a new block to be processed
   */
  async addBlock(chainId: number, block: Block): Promise<UnprocessedBlock> {
    const existingBlock = await this.repository.findOne({
      where: {
        chainId,
        blockNumber: block.number,
      },
    });

    if (existingBlock) {
      if (existingBlock.blockHash !== block.hash) {
        existingBlock.status = BlockProcessingStatus.REORGED;
        existingBlock.errorMessage = "Block hash mismatch - possible reorg";
        await this.repository.save(existingBlock);

        return this.createNewBlockEntry(chainId, block);
      }
      return existingBlock;
    }

    return this.createNewBlockEntry(chainId, block);
  }

  /**
   * Get blocks that need processing
   */
  async getBlocksToProcess(
    chainId: number,
    limit: number = 10
  ): Promise<UnprocessedBlock[]> {
    return this.repository.find({
      where: {
        chainId,
        status: BlockProcessingStatus.PENDING,
        retryCount: LessThan(this.MAX_RETRIES),
      },
      order: {
        blockNumber: "ASC",
      },
      take: limit,
    });
  }

  /**
   * Mark a block as processing
   */
  async markAsProcessing(block: UnprocessedBlock): Promise<void> {
    block.status = BlockProcessingStatus.PROCESSING;
    await this.repository.save(block);
  }

  /**
   * Mark a block as completed
   */
  async markAsCompleted(block: UnprocessedBlock): Promise<void> {
    block.status = BlockProcessingStatus.COMPLETED;
    block.processedAt = new Date();
    await this.repository.save(block);
  }

  /**
   * Mark a block as failed
   */
  async markAsFailed(block: UnprocessedBlock, error: Error): Promise<void> {
    block.status = BlockProcessingStatus.FAILED;
    block.retryCount += 1;
    block.errorMessage = error.message;
    await this.repository.save(block);
  }

  /**
   * Check for reorgs in recent blocks
   */
  async checkForReorgs(chainId: number, currentBlock: Block): Promise<void> {
    const recentBlocks = await this.repository.find({
      where: {
        chainId,
        blockNumber: MoreThanOrEqual(currentBlock.number - this.REORG_DEPTH),
        status: BlockProcessingStatus.COMPLETED,
      },
      order: {
        blockNumber: "DESC",
      },
    });

    for (const storedBlock of recentBlocks) {
      const chainBlock = await this.getBlockFromChain(
        chainId,
        storedBlock.blockNumber
      );

      if (!chainBlock || chainBlock.hash !== storedBlock.blockHash) {
        logger.warn("Reorg detected", {
          chainId,
          blockNumber: storedBlock.blockNumber,
          storedHash: storedBlock.blockHash,
          chainHash: chainBlock?.hash,
        });

        storedBlock.status = BlockProcessingStatus.REORGED;
        storedBlock.errorMessage = "Block hash mismatch - reorg detected";
        await this.repository.save(storedBlock);

        if (chainBlock) {
          await this.createNewBlockEntry(chainId, chainBlock);
        }
      }
    }
  }

  /**
   * Get blocks that need to be reprocessed due to reorgs
   */
  async getReorgedBlocks(chainId: number): Promise<UnprocessedBlock[]> {
    return this.repository.find({
      where: {
        chainId,
        status: BlockProcessingStatus.REORGED,
      },
      order: {
        blockNumber: "ASC",
      },
    });
  }

  private async createNewBlockEntry(
    chainId: number,
    block: Block
  ): Promise<UnprocessedBlock> {
    const newBlock = new UnprocessedBlock();
    newBlock.chainId = chainId;
    newBlock.blockNumber = block.number;
    newBlock.blockHash = block.hash ?? "";
    newBlock.parentHash = block.parentHash;
    newBlock.status = BlockProcessingStatus.PENDING;
    newBlock.retryCount = 0;
    newBlock.blockData = block;

    return this.repository.save(newBlock);
  }

  private async getBlockFromChain(
    chainId: number,
    blockNumber: number
  ): Promise<Block | null> {
    try {
      const block = await this.provider.getBlock(blockNumber);
      if (!block) {
        logger.warn("Block not found on chain", {
          chainId,
          blockNumber,
        });
        return null;
      }
      return block;
    } catch (error) {
      logger.error("Error fetching block from chain", {
        chainId,
        blockNumber,
        error,
      });
      return null;
    }
  }
}
