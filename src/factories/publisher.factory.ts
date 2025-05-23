import {
  RedisPublisher,
  RedisPublisherFactory,
  RedisConnectionOptions,
} from "../utils/types/redis.types";
import RedisPublisherImpl from "../services/publisher.service";
import logger from "../utils/logger";

export class RedisPublisherFactoryImpl implements RedisPublisherFactory {
  /**
   * Creates a Redis publisher with the specified configuration
   * @param host - Redis server host
   * @param port - Redis server port
   * @param channel - Channel to publish messages to
   * @param options - Additional Redis connection options
   * @returns RedisPublisher instance
   */
  createPublisher(
    host: string,
    port: number,
    channel: string,
    options?: RedisConnectionOptions
  ): RedisPublisher {
    logger.info("Creating Redis publisher", { host, port, channel });
    return new RedisPublisherImpl(host, port, channel, options);
  }
}

export default new RedisPublisherFactoryImpl();
