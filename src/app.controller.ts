import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  root() { return { name: 'MedPilot API', status: 'ok' }; }

  @Get('health')
  health() { return { status: 'ok', timestamp: new Date().toISOString() }; }
}
