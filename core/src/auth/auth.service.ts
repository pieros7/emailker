import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto) {
    const user = await this.usersService.findByEmail(loginDto.email);

    // Constant time check against fake hash if user not found to prevent enumeration
    const fakeHash =
      '$2b$12$L9qR1.vX/j/YF.gGqU/V.uF6Y7P5H6Q8R9S0T1U2V3W4X5Y6Z7A8B';
    let isValid = false;

    if (user) {
      isValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    } else {
      await bcrypt.compare(loginDto.password, fakeHash);
    }

    if (!isValid || !user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id, email: user.email };
    const token = this.jwtService.sign(payload);

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { passwordHash: _, ...userData } = user;
    return { token, user: userData };
  }
}
