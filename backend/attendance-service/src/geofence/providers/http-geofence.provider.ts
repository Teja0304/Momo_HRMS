import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GeofenceProvider } from '../interfaces/geofence-provider.interface';
import { MockGeofenceProvider } from './mock-geofence.provider';

@Injectable()
export class HttpGeofenceProvider implements GeofenceProvider {
  private readonly logger = new Logger(HttpGeofenceProvider.name);
  private readonly geofenceServiceUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly mockProvider: MockGeofenceProvider,
  ) {
    this.geofenceServiceUrl = this.configService.get<string>(
      'GEOFENCE_SERVICE_URL',
      'http://localhost:3003/api/v1',
    );
  }

  async isInsideOffice(officeId: string, latitude: number, longitude: number): Promise<boolean> {
    const isMock = this.configService.get<string>('GEOFENCE_USE_MOCK', 'false') === 'true';
    if (isMock) {
      return this.mockProvider.isInsideOffice(officeId, latitude, longitude);
    }

    try {
      const response = await fetch(`${this.geofenceServiceUrl}/geofence/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-gateway-secret': this.configService.get<string>('GATEWAY_SHARED_SECRET', 'dev-gateway-secret'),
        },
        body: JSON.stringify({ officeId, latitude, longitude }),
      });

      if (!response.ok) {
        if (response.status === 404) {
          this.logger.warn(`Office ${officeId} not found in Geofence Service; failing closed.`);
          return false;
        }
        this.logger.error(`Geofence service returned status ${response.status}; falling back to mock provider.`);
        return this.mockProvider.isInsideOffice(officeId, latitude, longitude);
      }

      const body = (await response.json()) as { success: boolean; data?: { isInside: boolean } };
      return body.data?.isInside ?? false;
    } catch (error) {
      this.logger.warn(
        `Failed to reach Geofence Service at ${this.geofenceServiceUrl} (${(error as Error).message}); falling back to in-memory mock provider.`,
      );
      return this.mockProvider.isInsideOffice(officeId, latitude, longitude);
    }
  }
}
