import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marca un endpoint como público (bypass de autenticación).
 *
 * Úsalo en endpoints que NO requieran JWT, por ejemplo:
 *   POST /auth/register, POST /auth/login, GET /health/live
 *
 * Ejemplo:
 *   @Public()
 *   @Post('login')
 *   login(@Body() dto: LoginDto) { ... }
 */
export const Public = (): MethodDecorator & ClassDecorator => SetMetadata(IS_PUBLIC_KEY, true);
