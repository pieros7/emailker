import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getAlive(): string {
    return 'I am alive';
  }
}
