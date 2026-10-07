import { Module } from '@nestjs/common';
import { GEOFENCE_PROVIDER } from './interfaces/geofence-provider.interface';
import { MockGeofenceProvider } from './providers/mock-geofence.provider';
import { HttpGeofenceProvider } from './providers/http-geofence.provider';

@Module({
  providers: [
    MockGeofenceProvider,
    HttpGeofenceProvider,
    { provide: GEOFENCE_PROVIDER, useExisting: HttpGeofenceProvider },
  ],
  exports: [GEOFENCE_PROVIDER, MockGeofenceProvider, HttpGeofenceProvider],
})
export class GeofenceModule {}

