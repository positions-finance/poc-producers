import express from "express";
import cors from "cors";
import { json } from "body-parser";
import cron from "node-cron";
import config from "./config/env";
import logger from "./utils/logger";
import BlockchainProviderFactory from "./factories/provider.factory";
import KafkaProducerFactory from "./factories/producer.factory";
import BlockchainIndexerFactory from "./factories/indexer.factory";
import { BlockchainIndexer } from "./utils/types/indexer.types";
import { TopicFilter } from "./utils/types/blockchain.types";
import { UnprocessedBlocksService } from "./services/unprocessed-blocks.service";
import { AppDataSource, initializeDatabase } from "./config/database";
import { UnprocessedBlock } from "./entities/UnprocessedBlock.entity";

const indexers: Map<string, BlockchainIndexer> = new Map();

/**
 * Initialize an indexer for a specific blockchain
 * @param chainName - Name of the blockchain to index
 * @param topicFilters - Array of topic filters to apply
 */
async function initializeIndexer(
  chainName: string,
  topicFilters: TopicFilter[]
): Promise<void> {
  try {
    logger.info(`Initializing indexer for ${chainName}`);

    const chainConfig = config.chains[chainName];
    if (!chainConfig) {
      logger.error(`No configuration found for chain: ${chainName}`);
      return;
    }

    const provider = BlockchainProviderFactory.createProvider(
      chainName,
      chainConfig.rpcUrl,
      chainConfig.wsUrl
    );

    const producer = KafkaProducerFactory.createProducer(
      config.kafka.clientId,
      config.kafka.brokers,
      config.kafka.topic
    );

    const unprocessedBlocksRepository =
      AppDataSource.getRepository(UnprocessedBlock);

    const unprocessedBlocksService = new UnprocessedBlocksService(
      unprocessedBlocksRepository
    );

    const indexer = BlockchainIndexerFactory.createIndexer(
      provider,
      producer,
      chainName,
      unprocessedBlocksService,
      topicFilters,
      chainConfig.startBlock,
      chainConfig.blockConfirmations
    );

    indexers.set(chainName, indexer);

    await indexer.start();

    logger.info(
      `Indexer for ${chainName} initialized and started successfully`
    );
  } catch (error) {
    logger.error(`Failed to initialize indexer for ${chainName}`, { error });
  }
}

/**
 * Stop all indexers
 */
async function stopAllIndexers(): Promise<void> {
  logger.info("Stopping all indexers");

  const stopPromises = Array.from(indexers.entries()).map(
    async ([chainName, indexer]) => {
      try {
        await indexer.stop();
        logger.info(`Indexer for ${chainName} stopped successfully`);
      } catch (error) {
        logger.error(`Error stopping indexer for ${chainName}`, { error });
      }
    }
  );

  await Promise.all(stopPromises);
  indexers.clear();

  logger.info("All indexers stopped");
}

/**
 * Setup API server
 */
function setupApiServer(): express.Application {
  const app = express();

  app.use(cors());
  app.use(json());

  app.get("/health", (req, res) => {
    const health = {
      status: "UP",
      timestamp: new Date().toISOString(),
      indexers: Array.from(indexers.entries()).map(([chainName, indexer]) => ({
        chainName,
        status: indexer.getStatus(),
      })),
    };

    res.json(health);
  });

  app.get("/api/indexers/:chainName/status", (req, res) => {
    const { chainName } = req.params;
    const indexer = indexers.get(chainName);

    if (!indexer) {
      return res.status(404).json({
        error: `Indexer for ${chainName} not found`,
      });
    }

    res.json({
      chainName,
      status: indexer.getStatus(),
    });
  });

  app.get("/api/indexers/:chainName/filters", (req, res) => {
    const { chainName } = req.params;
    const indexer = indexers.get(chainName);

    if (!indexer) {
      return res.status(404).json({
        error: `Indexer for ${chainName} not found`,
      });
    }

    res.json({
      chainName,
      filters: indexer.getTopicFilters(),
    });
  });

  app.post("/api/indexers/:chainName/filters", (req, res) => {
    const { chainName } = req.params;
    const { hash, description } = req.body;

    if (!hash) {
      return res.status(400).json({
        error: "Topic hash is required",
      });
    }

    const indexer = indexers.get(chainName);

    if (!indexer) {
      return res.status(404).json({
        error: `Indexer for ${chainName} not found`,
      });
    }

    indexer.addTopicFilter({ hash, description });

    res.json({
      message: `Filter added to ${chainName}`,
      filter: { hash, description },
    });
  });

  app.delete("/api/indexers/:chainName/filters/:hash", (req, res) => {
    const { chainName, hash } = req.params;

    const indexer = indexers.get(chainName);

    if (!indexer) {
      return res.status(404).json({
        error: `Indexer for ${chainName} not found`,
      });
    }

    indexer.removeTopicFilter(hash);

    res.json({
      message: `Filter removed from ${chainName}`,
      hash,
    });
  });

  app.post("/api/indexers/:chainName/pause", async (req, res) => {
    const { chainName } = req.params;

    const indexer = indexers.get(chainName);

    if (!indexer) {
      return res.status(404).json({
        error: `Indexer for ${chainName} not found`,
      });
    }

    await indexer.pause();

    res.json({
      message: `Indexer for ${chainName} paused`,
    });
  });

  app.post("/api/indexers/:chainName/resume", async (req, res) => {
    const { chainName } = req.params;

    const indexer = indexers.get(chainName);

    if (!indexer) {
      return res.status(404).json({
        error: `Indexer for ${chainName} not found`,
      });
    }

    await indexer.resume();

    res.json({
      message: `Indexer for ${chainName} resumed`,
    });
  });

  return app;
}

/**
 * Setup health check job
 */
function setupHealthCheck(): void {
  cron.schedule("* * * * *", () => {
    logger.debug("Running health check");

    for (const [chainName, indexer] of indexers.entries()) {
      const status = indexer.getStatus();

      logger.debug(`Indexer ${chainName} status`, {
        status,
        healthy: status.isHealthy,
      });

      if (!status.isHealthy && !status.isPaused) {
        logger.warn(
          `Unhealthy indexer detected: ${chainName}, attempting restart`
        );

        indexer
          .stop()
          .then(() => {
            logger.info(`Restarting indexer: ${chainName}`);
            indexer.start().catch((error) => {
              logger.error(`Failed to restart indexer ${chainName}`, { error });
            });
          })
          .catch((error) => {
            logger.error(`Failed to stop unhealthy indexer ${chainName}`, {
              error,
            });
          });
      }
    }
  });

  logger.info("Health check scheduled");
}

/**
 * Main function to start the application
 */
async function main(): Promise<void> {
  try {
    logger.info("Starting blockchain indexer service");

    const app = setupApiServer();

    const server = app.listen(config.api.port, config.api.host, () => {
      logger.info(
        `API server started on ${config.api.host}:${config.api.port}`
      );
    });

    process.on("SIGTERM", async () => {
      logger.info("SIGTERM received, shutting down");

      await stopAllIndexers();

      server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
    });

    process.on("SIGINT", async () => {
      logger.info("SIGINT received, shutting down");
      await stopAllIndexers();

      server.close(() => {
        logger.info("HTTP server closed");
        process.exit(0);
      });
    });

    setupHealthCheck();

    const chainNames = Object.keys(config.chains);

    const topicFilters: TopicFilter[] = [
      {
        hash: "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",
        description: "ERC20 Transfer Event",
      },
    ];

    await initializeDatabase();

    for (const chainName of chainNames) {
      await initializeIndexer(chainName, topicFilters);
    }

    logger.info("Blockchain indexer service started successfully");
  } catch (error) {
    logger.error("Failed to start blockchain indexer service", { error });
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error("Unhandled error", { error });
  process.exit(1);
});
