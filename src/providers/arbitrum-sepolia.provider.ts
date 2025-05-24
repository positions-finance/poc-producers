import {
  JsonRpcProvider,
  WebSocketProvider,
  Block,
  TransactionReceipt,
} from "ethers";
import { BlockchainProvider } from "../utils/types/blockchain.types";
import logger from "../utils/logger";

/**
 * Implementation of BlockchainProvider for Arbitrum Sepolia
 */
export default class ArbitrumSepoliaProvider implements BlockchainProvider {
  private rpcProvider: JsonRpcProvider;
  private wsProvider: WebSocketProvider | null = null;
  private chainId: number = 421614;
  private blockCallback: ((blockNumber: number) => void) | null = null;
  private isWsConnected: boolean = false;
  private readonly chainName = "arbitrum-sepolia";

  /**
   * Creates a new Arbitrum Sepolia provider
   * @param rpcUrl - HTTP RPC URL for Arbitrum Sepolia node
   * @param wsUrl - WebSocket URL for Arbitrum Sepolia node (for subscribing to new blocks)
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

      if (this.wsProvider) {
        this.wsProvider.websocket.onopen = () => {
          logger.info("Arbitrum Sepolia WebSocket connected", {
            wsUrl: this.wsUrl,
          });
          this.isWsConnected = true;

          if (this.blockCallback) {
            this.wsProvider?.on("block", (blockNumber) => {
              logger.debug(
                "New Arbitrum Sepolia block detected via WebSocket",
                {
                  blockNumber,
                }
              );
              if (this.blockCallback) {
                this.blockCallback(blockNumber);
              }
            });
          }
        };

        // @ts-expect-error - onclose is not defined on WebSocketLike
        this.wsProvider.websocket.onclose = () => {
          logger.warn("Arbitrum Sepolia WebSocket disconnected", {
            wsUrl: this.wsUrl,
          });
          this.isWsConnected = false;

          setTimeout(() => {
            logger.info("Attempting to reconnect Arbitrum Sepolia WebSocket", {
              wsUrl: this.wsUrl,
            });
            this.setupWebSocketProvider();
          }, 5000);
        };

        this.wsProvider.websocket.onerror = (error) => {
          logger.error("Arbitrum Sepolia WebSocket error", {
            error,
            wsUrl: this.wsUrl,
          });
          this.isWsConnected = false;
        };
      }
    } catch (error) {
      logger.error("Failed to setup Arbitrum Sepolia WebSocket provider", {
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
      logger.debug("Retrieved latest Arbitrum Sepolia block", { blockNumber });
      return blockNumber;
    } catch (error) {
      logger.error("Failed to get latest Arbitrum Sepolia block", { error });
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
      logger.debug("Retrieved Arbitrum Sepolia block", { blockNumber });
      return block;
    } catch (error) {
      logger.error("Failed to get Arbitrum Sepolia block", {
        blockNumber,
        error,
      });
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
      logger.debug("Retrieved Arbitrum Sepolia block with transactions", {
        blockNumber,
        transactionCount: block?.transactions?.length || 0,
      });
      return block;
    } catch (error) {
      logger.error("Failed to get Arbitrum Sepolia block with transactions", {
        blockNumber,
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
      logger.error("Arbitrum Sepolia provider health check failed", { error });
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
      // Remove any existing listeners to avoid duplicates
      this.wsProvider.removeAllListeners("block");

      this.wsProvider.on("block", (blockNumber) => {
        logger.debug("New Arbitrum Sepolia block detected via WebSocket", {
          blockNumber,
        });
        if (this.blockCallback) {
          this.blockCallback(blockNumber);
        }
      });

      logger.info("Subscribed to new Arbitrum Sepolia blocks via WebSocket", {
        wsUrl: this.wsUrl,
      });
    } else {
      const POLLING_INTERVAL = 1000;
      let lastBlockNumber = 0;

      const pollForBlocks = async () => {
        try {
          const blockNumber = await this.getLatestBlock();
          if (this.blockCallback && blockNumber > lastBlockNumber) {
            lastBlockNumber = blockNumber;
            this.blockCallback(blockNumber);
          }
        } catch (error) {
          logger.error("Error polling for new Arbitrum Sepolia blocks", {
            error,
          });
        }

        setTimeout(pollForBlocks, POLLING_INTERVAL);
      };

      pollForBlocks();
      logger.info("Subscribed to new Arbitrum Sepolia blocks via polling", {
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
      logger.info("Unsubscribed from Arbitrum Sepolia blocks");
    }
    this.blockCallback = null;
  }

  /**
   * Get the name of the chain
   */
  getChainName(): string {
    return this.chainName;
  }

  /**
   * Get transaction receipt by hash
   * @param txHash - The transaction hash to retrieve
   */
  async getTransactionReceipt(
    txHash: string
  ): Promise<TransactionReceipt | null> {
    try {
      const receipt = await this.rpcProvider.getTransactionReceipt(txHash);
      logger.debug("Retrieved Arbitrum Sepolia transaction receipt", {
        txHash,
      });
      return receipt;
    } catch (error) {
      logger.error("Failed to get Arbitrum Sepolia transaction receipt", {
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
      logger.debug("Retrieved Arbitrum Sepolia transaction", { txHash });
      return transaction;
    } catch (error) {
      logger.error("Failed to get Arbitrum Sepolia transaction", {
        txHash,
        error,
      });
      throw error;
    }
  }
}
