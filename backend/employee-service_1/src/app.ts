import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';
import { env, API_PREFIX } from './config/env';
import { requestLogger } from './middleware/requestLogger';
import { notFoundHandler, errorHandler } from './middleware/errorHandler';

import departmentRoutes from './modules/departments/department.routes';
import employeeRoutes from './modules/employees/employee.routes';
import { rolesRouter, employeeRoleRouter } from './modules/roles/role.routes';
import { devicesRouter, employeeDevicesRouter } from './modules/devices/device.routes';
import { faceTemplatesRouter, employeeFaceTemplateRouter } from './modules/face-templates/face-template.routes';
import { internalRouter } from './modules/attendance-integration/attendance-integration.routes';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(requestLogger);

  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, data: { status: 'ok', service: 'employee-service' } });
  });

  // Swagger UI at /api-docs, served from the OpenAPI file in src/docs.
  try {
    const openapiPath = path.join(__dirname, 'docs', 'openapi.yaml');
    const openapiDocument = YAML.parse(readFileSync(openapiPath, 'utf-8'));
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
  } catch {
    // Docs are optional at runtime — the API still works without them.
  }

  // Employees: several routers share the same /employees prefix, each adding
  // its own sub-paths (CRUD, /role, /devices, /face-template).
  app.use(`${API_PREFIX}/employees`, employeeRoutes);
  app.use(`${API_PREFIX}/employees`, employeeRoleRouter);
  app.use(`${API_PREFIX}/employees`, employeeDevicesRouter);
  app.use(`${API_PREFIX}/employees`, employeeFaceTemplateRouter);

  app.use(`${API_PREFIX}/departments`, departmentRoutes);
  app.use(`${API_PREFIX}/roles`, rolesRouter);
  app.use(`${API_PREFIX}/devices`, devicesRouter);
  app.use(`${API_PREFIX}/face-templates`, faceTemplatesRouter);
  app.use(`${API_PREFIX}/internal`, internalRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
