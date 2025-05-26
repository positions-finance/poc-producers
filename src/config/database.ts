import { DataSource } from "typeorm";
import config from "./env";

export const AppDataSource = new DataSource({
  type: "postgres",
  host: config.database.host,
  port: config.database.port,
  username: config.database.username,
  password: config.database.password,
  database: config.database.name,
  synchronize: config.nodeEnv === "development" ? true : false,
  logging: config.database.logging,
  entities: ["src/entities/*.entity.ts"],
  migrations: ["src/migrations/*.ts"],
  subscribers: [],
  ssl: {
    rejectUnauthorized: false,
  },
});

export const initializeDatabase = async () => {
  try {
    await AppDataSource.initialize();
    console.log("Database connection initialized successfully");
  } catch (error) {
    console.error("Error initializing database connection:", error);
    throw error;
  }
};
