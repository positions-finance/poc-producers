import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

@Entity("processed_blocks")
export class ProcessedBlock {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  @Index()
  chainId: number;

  @Column()
  @Index()
  blockNumber: number;

  @Column()
  blockHash: string;

  @Column()
  parentHash: string;

  @Column({ type: "jsonb", nullable: true })
  blockData: any;

  @Column({ default: false })
  isReorged: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
