import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Controller('health')
export class HealthController {
  private readonly services: Record<string, string>;

  constructor(private readonly configService: ConfigService) {
    this.services = {
      auth: this.configService.get<string>('services.auth', 'http://localhost:3001'),
      attendance: this.configService.get<string>('services.attendance', 'http://localhost:3002'),
      geofence: this.configService.get<string>('services.geofence', 'http://localhost:3003'),
      employee: this.configService.get<string>('services.employee', 'http://localhost:3004'),
      notification: this.configService.get<string>('services.notification', 'http://localhost:3005'),
    };
  }

  @Get()
  async check() {
    const checks: Record<string, any> = {};

    await Promise.all(
      Object.entries(this.services).map(async ([name, url]) => {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 2000);
          let res = await fetch(`${url}/health`, { signal: controller.signal });
          if (!res.ok && res.status === 404) {
            res = await fetch(`${url}/api/v1/health`, { signal: controller.signal });
          }
          clearTimeout(timeoutId);
          checks[name] = res.ok ? 'up' : `status ${res.status}`;
        } catch {
          checks[name] = 'down';
        }
      }),
    );

    const allUp = Object.values(checks).every((s) => s === 'up');

    return {
      status: allUp ? 'healthy' : 'degraded',
      service: 'api-gateway',
      port: this.configService.get<number>('port', 8000),
      timestamp: new Date().toISOString(),
      microservices: checks,
    };
  }
}
