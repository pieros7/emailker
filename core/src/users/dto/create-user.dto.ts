import { IsEmail, IsString, MinLength, IsUUID } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  name: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsUUID()
  roleId: string;
}
