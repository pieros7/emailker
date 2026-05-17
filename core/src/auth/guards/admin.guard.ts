import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // TODO: implementar cuando el módulo de roles esté disponible
    return true; // bloquea todo hasta que se implemente
  }
}
