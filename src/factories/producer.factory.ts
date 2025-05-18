import {
  KafkaProducer,
  KafkaProducerFactory,
} from "../utils/types/kafka.types";
import KafkaJsProducer from "../services/producer.service";
import logger from "../utils/logger";

export class KafkaProducerFactoryImpl implements KafkaProducerFactory {
  /**
   * Creates a Kafka producer with the specified configuration
   * @param clientId - Client ID for Kafka producer
   * @param brokers - Array of Kafka broker URLs
   * @param topic - Topic to produce messages to
   * @returns KafkaProducer instance
   */
  createProducer(
    clientId: string,
    brokers: string[],
    topic: string
  ): KafkaProducer {
    logger.info("Creating Kafka producer", { clientId, brokers, topic });
    return new KafkaJsProducer(clientId, brokers, topic);
  }
}

export default new KafkaProducerFactoryImpl();
