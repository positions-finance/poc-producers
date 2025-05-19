import { Repository, Between } from "typeorm";
import { ProcessedBlock } from "../entities/processed-blocks.entity";
import { Block } from "ethers";
import logger from "../utils/logger";

export class ProcessedBlocksService {
  constructor(private repository: Repository<ProcessedBlock>) {}

  /**
   * Add a processed block
   */
  async addBlock(chainId: number, block: Block): Promise<ProcessedBlock> {
    const processedBlock = this.repository.create({
      chainId,
      blockNumber: block.number,
      blockHash: block.hash || "",
      parentHash: block.parentHash || "",
      blockData: block,
      isReorged: false,
    });

    await this.repository.save(processedBlock);

    logger.debug("Added processed block", {
      chainId,
      blockNumber: block.number,
      blockHash: block.hash,
    });

    return processedBlock;
  }

  /**
   * Get the latest processed block for a chain
   */
  async getLatestProcessedBlock(
    chainId: number
  ): Promise<ProcessedBlock | null> {
    return this.repository.findOne({
      where: { chainId },
      order: { blockNumber: "DESC" },
    });
  }

  /**
   * Check if a block has been processed
   */
  async isBlockProcessed(
    chainId: number,
    blockNumber: number
  ): Promise<boolean> {
    const count = await this.repository.count({
      where: { chainId, blockNumber },
    });
    return count > 0;
  }

  /**
   * Get all processed blocks in a range
   */
  async getProcessedBlocksInRange(
    chainId: number,
    startBlock: number,
    endBlock: number
  ): Promise<ProcessedBlock[]> {
    return this.repository.find({
      where: {
        chainId,
        blockNumber: Between(startBlock, endBlock),
      },
      order: { blockNumber: "ASC" },
    });
  }

  /**
   * Mark a block as reorged
   */
  async markAsReorged(chainId: number, blockNumber: number): Promise<void> {
    await this.repository.update({ chainId, blockNumber }, { isReorged: true });

    logger.info("Marked block as reorged", {
      chainId,
      blockNumber,
    });
  }

  /**
   * Get all reorged blocks
   */
  async getReorgedBlocks(chainId: number): Promise<ProcessedBlock[]> {
    return this.repository.find({
      where: { chainId, isReorged: true },
      order: { blockNumber: "ASC" },
    });
  }
}
