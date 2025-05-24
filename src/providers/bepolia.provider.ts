import {
  JsonRpcProvider,
  WebSocketProvider,
  Block,
  TransactionReceipt,
} from "ethers";
import { BlockchainProvider } from "../utils/types/blockchain.types";
import logger from "../utils/logger";

/**
 * Implementation of BlockchainProvider for Bepolia
 */
export default class BepoliaProvider implements BlockchainProvider {
  private rpcProvider: JsonRpcProvider;
  private wsProvider: WebSocketProvider | null = null;
  private chainId: number = 80069;
  private blockCallback: ((blockNumber: number) => void) | null = null;
  private isWsConnected: boolean = false;
  private readonly chainName = "Bepolia";

  /**
   * Creates a new Bepolia provider
   * @param rpcUrl - HTTP RPC URL for Bepolia node
   * @param wsUrl - WebSocket URL for Bepolia node (for subscribing to new blocks)
   */
  constructor(private rpcUrl: string, private wsUrl: string) {
    this.rpcProvider = new JsonRpcProvider(rpcUrl);

    if (wsUrl) {
      this.setupWebSocketProvider();
    }
  }

  /**
   * Setup WebSocket provider and event listeners
   */
  private setupWebSocketProvider(): void {
    try {
      this.wsProvider = new WebSocketProvider(this.wsUrl);

      // Setup event listeners
      if (this.wsProvider && this.wsProvider.websocket) {
        // Use the appropriate WebSocket event handlers
        this.wsProvider.websocket.onopen = () => {
          logger.info("Bepolia WebSocket connected", { wsUrl: this.wsUrl });
          this.isWsConnected = true;
        };

        this.wsProvider.websocket.onerror = (error) => {
          logger.error("Bepolia WebSocket error", { error, wsUrl: this.wsUrl });
          this.isWsConnected = false;

          setTimeout(() => {
            this.setupWebSocketProvider();
          }, 5000);
        };
      }
    } catch (error) {
      logger.error("Failed to setup Bepolia WebSocket provider", {
        error,
        wsUrl: this.wsUrl,
      });
    }
  }

  /**
   * Get the current latest block number
   */
  async getLatestBlock(): Promise<number> {
    try {
      const blockNumber = await this.rpcProvider.getBlockNumber();
      logger.debug("Retrieved latest Bepolia block", { blockNumber });
      return blockNumber;
    } catch (error) {
      logger.error("Failed to get latest Bepolia block", { error });
      throw error;
    }
  }

  /**
   * Get a block by its number
   * @param blockNumber - The block number to retrieve
   */
  async getBlock(blockNumber: number): Promise<Block | null> {
    try {
      const block = await this.rpcProvider.getBlock(blockNumber);
      logger.debug("Retrieved Bepolia block", { blockNumber });
      return block;
    } catch (error) {
      logger.error("Failed to get Bepolia block", { blockNumber, error });
      throw error;
    }
  }

  /**
   * Get a block with its transactions by block number
   * @param blockNumber - The block number to retrieve
   */
  async getBlockWithTransactions(blockNumber: number): Promise<Block | null> {
    try {
      const block = await this.rpcProvider.getBlock(blockNumber, true);
      logger.debug("Retrieved Bepolia block with transactions", {
        blockNumber,
        transactionCount: block?.transactions?.length || 0,
      });
      return block;
    } catch (error) {
      logger.error("Failed to get Bepolia block with transactions", {
        blockNumber,
        error,
      });
      throw error;
    }
  }

  /**
   * Get transaction receipt by transaction hash
   * @param txHash - The transaction hash to get receipt for
   */
  async getTransactionReceipt(
    txHash: string
  ): Promise<TransactionReceipt | null> {
    try {
      const receipt = await this.rpcProvider.getTransactionReceipt(txHash);
      logger.debug("Retrieved Bepolia transaction receipt", { txHash });
      return receipt;
    } catch (error) {
      logger.error("Failed to get Bepolia transaction receipt", {
        txHash,
        error,
      });
      throw error;
    }
  }

  /**
   * Get transaction by transaction hash
   * @param txHash - The transaction hash to get details for
   */
  async getTransaction(txHash: string): Promise<any | null> {
    try {
      const transaction = await this.rpcProvider.getTransaction(txHash);
      logger.debug("Retrieved Bepolia transaction", { txHash });
      return transaction;
    } catch (error) {
      logger.error("Failed to get Bepolia transaction", {
        txHash,
        error,
      });
      throw error;
    }
  }

  /**
   * Get the chain ID
   */
  async getChainId(): Promise<number> {
    return this.chainId;
  }

  /**
   * Check if the provider is healthy
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.rpcProvider.getNetwork();

      const wsHealthy = !this.wsUrl || this.isWsConnected;

      return wsHealthy;
    } catch (error) {
      logger.error("Bepolia provider health check failed", { error });
      return false;
    }
  }

  /**
   * Subscribe to new blocks
   * @param callback - Function to call when a new block is detected
   */
  subscribeToNewBlocks(callback: (blockNumber: number) => void): void {
    this.blockCallback = callback;

    if (this.wsProvider) {
      this.wsProvider.on("block", (blockNumber) => {
        logger.debug("New Bepolia block detected via WebSocket", {
          blockNumber,
        });
        if (this.blockCallback) {
          this.blockCallback(blockNumber);
        }
      });

      logger.info("Subscribed to new Bepolia blocks via WebSocket", {
        wsUrl: this.wsUrl,
      });
    } else {
      const POLLING_INTERVAL = 1000;

      const pollForBlocks = async () => {
        try {
          const blockNumber = await this.getLatestBlock();
          if (this.blockCallback) {
            this.blockCallback(blockNumber);
          }
        } catch (error) {
          logger.error("Error polling for new Bepolia blocks", { error });
        }

        setTimeout(pollForBlocks, POLLING_INTERVAL);
      };

      pollForBlocks();
      logger.info("Subscribed to new Bepolia blocks via polling", {
        interval: POLLING_INTERVAL,
      });
    }
  }

  /**
   * Unsubscribe from new blocks
   */
  unsubscribeFromNewBlocks(): void {
    if (this.wsProvider) {
      this.wsProvider.removeAllListeners("block");
      logger.info("Unsubscribed from Bepolia blocks");
    }
    this.blockCallback = null;
  }

  /**
   * Get the name of the chain
   */
  getChainName(): string {
    return this.chainName;
  }
}
