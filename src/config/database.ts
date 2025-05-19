import { DataSource } from "typeorm";
import { UnprocessedBlock } from "../entities/UnprocessedBlock.entity";
import config from "./env";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
  synchronize: false, // Set to false in production
  logging: config.database.logging,
  entities: [UnprocessedBlock],
  migrations: ["src/migrations/*.ts"],
  subscribers: [],
  ssl: config.database.ssl
    ? {
        rejectUnauthorized: false,
      }
    : false,
});

// Initialize the data source
export const initializeDatabase = async () => {
  try {
    await AppDataSource.initialize();
    console.log("Database connection initialized successfully");
  } catch (error) {
    console.error("Error initializing database connection:", error);
    throw error;
  }
};
