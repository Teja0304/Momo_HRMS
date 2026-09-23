import { Module } from '@nestjs/common';
import { GEOFENCE_PROVIDER } from './interfaces/geofence-provider.interface';
import { MockGeofenceProvider } from './providers/mock-geofence.provider';

@Module({
  providers: [
    MockGeofenceProvider,
    { provide: GEOFENCE_PROVIDER, useExisting: MockGeofenceProvider },
  ],
  exports: [GEOFENCE_PROVIDER],
})
export class GeofenceModule {}
