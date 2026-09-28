import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCodes } from '../../common/constants/error-codes';
import { VerifyLocationDto } from '../dto/verify-location.dto';
import { CreateOfficeDto } from '../dto/create-office.dto';
import { SetPolygonDto } from '../dto/set-polygon.dto';
import {
  distanceToPolygonBoundaryMeters,
  isPointInPolygon,
  validatePolygonVertices,
} from '../utils/point-in-polygon.util';
import { VerifyLocationResponseDto } from '../dto/office-response.dto';

@Injectable()
export class GeofenceService {
  private readonly logger = new Logger(GeofenceService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Verify whether a given employee GPS coordinate falls inside the office polygon.
   */
  async verifyLocation(dto: VerifyLocationDto): Promise<VerifyLocationResponseDto> {
    const office = await this.prisma.office.findFirst({
      where: {
        OR: [{ id: dto.officeId }, { code: dto.officeId }],
        isActive: true,
      },
      include: {
        polygons: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
          include: {
            vertices: {
              orderBy: { sequence: 'asc' },
            },
          },
          take: 1,
        },
      },
    });

    if (!office) {
      this.logger.warn(`Verification failed: Office ${dto.officeId} not found or inactive.`);
      throw new AppException(
        ErrorCodes.OFFICE_NOT_FOUND,
        'Office not found or inactive',
        HttpStatus.NOT_FOUND,
      );
    }

    const activePolygon = office.polygons[0];
    if (!activePolygon || activePolygon.vertices.length < 3) {
      this.logger.warn(`Verification failed: No active polygon configured for office ${office.name}`);
      throw new AppException(
        ErrorCodes.NO_ACTIVE_POLYGON,
        'No active geofence polygon configured for this office',
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    const polygonPoints = activePolygon.vertices.map((v) => ({
      latitude: v.latitude,
      longitude: v.longitude,
    }));

    const point = { latitude: dto.latitude, longitude: dto.longitude };
    const isInside = isPointInPolygon(point, polygonPoints);
    const distanceToBoundary = distanceToPolygonBoundaryMeters(point, polygonPoints);

    // Altitude validation (optional signal)
    let altitudeValid = true;
    const minAlt = activePolygon.minAltitudeMeters ?? office.minAltitudeMeters;
    const maxAlt = activePolygon.maxAltitudeMeters ?? office.maxAltitudeMeters;

    if (dto.altitudeMeters !== undefined && minAlt !== null && minAlt !== undefined && maxAlt !== null && maxAlt !== undefined) {
      altitudeValid = dto.altitudeMeters >= minAlt && dto.altitudeMeters <= maxAlt;
    }

    this.logger.log(
      `Verify location for office=${office.code} point=(${dto.latitude}, ${dto.longitude}) -> isInside=${isInside}, distance=${distanceToBoundary}m`,
    );

    return {
      isInside,
      officeId: office.id,
      officeName: office.name,
      distanceToBoundaryMeters: distanceToBoundary,
      altitudeValid,
    };
  }

  /**
   * List all registered offices.
   */
  async listOffices() {
    const offices = await this.prisma.office.findMany({
      include: {
        polygons: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
          include: {
            vertices: { orderBy: { sequence: 'asc' } },
          },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
    });

    return offices.map((o) => ({
      id: o.id,
      code: o.code,
      name: o.name,
      address: o.address,
      city: o.city,
      country: o.country,
      isActive: o.isActive,
      minAltitudeMeters: o.minAltitudeMeters,
      maxAltitudeMeters: o.maxAltitudeMeters,
      activePolygon: o.polygons[0]
        ? {
            id: o.polygons[0].id,
            name: o.polygons[0].name,
            version: o.polygons[0].version,
            isActive: o.polygons[0].isActive,
            vertices: o.polygons[0].vertices.map((v) => ({
              sequence: v.sequence,
              latitude: v.latitude,
              longitude: v.longitude,
            })),
          }
        : null,
    }));
  }

  /**
   * Get single office by ID or Code.
   */
  async getOfficeById(idOrCode: string) {
    const office = await this.prisma.office.findFirst({
      where: {
        OR: [{ id: idOrCode }, { code: idOrCode }],
      },
      include: {
        polygons: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
          include: {
            vertices: { orderBy: { sequence: 'asc' } },
          },
          take: 1,
        },
      },
    });

    if (!office) {
      throw new AppException(ErrorCodes.OFFICE_NOT_FOUND, 'Office not found', HttpStatus.NOT_FOUND);
    }

    return {
      id: office.id,
      code: office.code,
      name: office.name,
      address: office.address,
      city: office.city,
      country: office.country,
      isActive: office.isActive,
      minAltitudeMeters: office.minAltitudeMeters,
      maxAltitudeMeters: office.maxAltitudeMeters,
      activePolygon: office.polygons[0]
        ? {
            id: office.polygons[0].id,
            name: office.polygons[0].name,
            version: office.polygons[0].version,
            isActive: office.polygons[0].isActive,
            vertices: office.polygons[0].vertices.map((v) => ({
              sequence: v.sequence,
              latitude: v.latitude,
              longitude: v.longitude,
            })),
          }
        : null,
    };
  }

  /**
   * Create an office (Admin / HR only).
   */
  async createOffice(dto: CreateOfficeDto) {
    const existing = await this.prisma.office.findUnique({
      where: { code: dto.code },
    });

    if (existing) {
      throw new AppException(
        ErrorCodes.DUPLICATE_OFFICE_CODE,
        `Office with code ${dto.code} already exists`,
        HttpStatus.CONFLICT,
      );
    }

    return this.prisma.office.create({
      data: {
        code: dto.code,
        name: dto.name,
        address: dto.address,
        city: dto.city,
        country: dto.country,
        minAltitudeMeters: dto.minAltitudeMeters,
        maxAltitudeMeters: dto.maxAltitudeMeters,
        isActive: dto.isActive ?? true,
      },
    });
  }

  /**
   * Set or update office geofence polygon (Admin / HR only).
   */
  async setOfficePolygon(idOrCode: string, dto: SetPolygonDto) {
    const office = await this.prisma.office.findFirst({
      where: { OR: [{ id: idOrCode }, { code: idOrCode }] },
    });

    if (!office) {
      throw new AppException(ErrorCodes.OFFICE_NOT_FOUND, 'Office not found', HttpStatus.NOT_FOUND);
    }

    const validation = validatePolygonVertices(dto.vertices);
    if (!validation.valid) {
      throw new AppException(
        ErrorCodes.INVALID_POLYGON,
        validation.error ?? 'Invalid polygon vertices',
        HttpStatus.BAD_REQUEST,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      // Deactivate older active polygons
      await tx.geofencePolygon.updateMany({
        where: { officeId: office.id, isActive: true },
        data: { isActive: false },
      });

      const count = await tx.geofencePolygon.count({
        where: { officeId: office.id },
      });

      const newPolygon = await tx.geofencePolygon.create({
        data: {
          officeId: office.id,
          name: dto.name ?? `Boundary v${count + 1}`,
          version: count + 1,
          isActive: true,
          minAltitudeMeters: dto.minAltitudeMeters,
          maxAltitudeMeters: dto.maxAltitudeMeters,
          vertices: {
            create: dto.vertices.map((v, index) => ({
              sequence: index,
              latitude: v.latitude,
              longitude: v.longitude,
            })),
          },
        },
        include: {
          vertices: { orderBy: { sequence: 'asc' } },
        },
      });

      return newPolygon;
    });
  }
}
