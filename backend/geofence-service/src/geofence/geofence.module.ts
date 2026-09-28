import { Module } from '@nestjs/common';
import { GeofenceController } from './controllers/geofence.controller';
import { OfficeController } from './controllers/office.controller';
import { GeofenceService } from './services/geofence.service';

@Module({
  controllers: [GeofenceController, OfficeController],
  providers: [GeofenceService],
  exports: [GeofenceService],
})
export class GeofenceModule {}
