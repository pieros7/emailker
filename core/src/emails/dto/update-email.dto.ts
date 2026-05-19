import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsUUID,
} from 'class-validator';
import { EmailStatus } from '../enums/email-status.enum';

export class UpdateEmailDto {
  @IsString()
  @IsOptional()
  nombre?: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsEnum(EmailStatus)
  @IsOptional()
  estado?: EmailStatus;

  @IsObject()
  @IsOptional()
  estadoEditorJson?: any;

  @IsUUID()
  @IsOptional()
  idVersionActual?: string;
}
