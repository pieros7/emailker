import {
  Controller,
  Post,
  Body,
  Res,
  Get,
  UseGuards,
  Req,
} from '@nestjs/common';
import * as express from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) response: express.Response,
  ) {
    const { token, user } = await this.authService.login(loginDto);

    response.cookie('token', token, {
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      // secure: process.env.NODE_ENV === 'production',
    });

    return user;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  logout(@Res({ passthrough: true }) response: express.Response) {
    response.clearCookie('token', { path: '/' });
    return { message: 'Logged out' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@Req() req: express.Request) {
    return req.user;
  }
}
