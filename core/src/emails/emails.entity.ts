import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { EmailStatus } from './enums/email-status.enum';

@Entity('emails')
export class Email {
  @PrimaryGeneratedColumn('uuid', { name: 'id_correo' })
  idCorreo: string;

  @Column({ name: 'id_proyecto' })
  idProyecto: string;

  @Column({ name: 'id_usuario_creador' })
  idUsuarioCreador: string;

  @Column({ name: 'id_version_actual', nullable: true })
  idVersionActual: string;

  @Column({ type: 'jsonb', name: 'estado_editor_json', nullable: true })
  estadoEditorJson: any;

  @Column({ name: 'nombre' })
  nombre: string;

  @Column({ type: 'text', name: 'descripcion' })
  descripcion: string;

  @Column({
    type: 'enum',
    enum: EmailStatus,
    default: EmailStatus.BORRADOR,
    name: 'estado',
  })
  estado: EmailStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date | null;
}
