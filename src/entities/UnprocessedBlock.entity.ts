import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

export enum BlockProcessingStatus {
  PENDING = "pending",
  PROCESSING = "processing",
  FAILED = "failed",
  COMPLETED = "completed",
  REORGED = "reorged",
}

@Entity("unprocessed_blocks")
export class UnprocessedBlock {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Index()
  @Column({ type: "integer" })
  chainId: number;

  @Index()
  @Column({ type: "integer" })
  blockNumber: number;

  @Column({ type: "varchar" })
  blockHash: string;

  @Column({ type: "varchar" })
  parentHash: string;

  @Column({
    type: "enum",
    enum: BlockProcessingStatus,
    default: BlockProcessingStatus.PENDING,
  })
  status: BlockProcessingStatus;

  @Column({ default: 0 })
  retryCount: number;

  @Column({ type: "text", nullable: true })
  errorMessage?: string;

  @Column({ type: "jsonb", nullable: true })
  blockData?: any;

  @CreateDateColumn({ type: "timestamp" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamp" })
  updatedAt: Date;

  @Column({ type: "timestamp", nullable: true })
  processedAt?: Date;
}
