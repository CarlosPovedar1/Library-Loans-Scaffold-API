import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get('live')
  @ApiOperation({ summary: 'Liveness probe — el servicio está vivo' })
  live(): { status: string } {
    return { status: 'ok' };
  }

  @Public()
  @Get('ready')
  @ApiOperation({ summary: 'Readiness probe — el servicio puede atender requests' })
  ready(): { status: string } {
    return { status: 'ok' };
  }
}
