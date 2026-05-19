import { IsString, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class CreateEmailDto {
  @IsString()
  @IsNotEmpty()
  nombre: string;

  @IsString()
  @IsOptional()
  descripcion?: string;

  @IsUUID()
  @IsNotEmpty()
  idProyecto: string;

  @IsUUID()
  @IsNotEmpty()
  idUsuarioCreador: string;
}
