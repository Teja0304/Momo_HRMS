import { Router } from 'express';
import type { RequestHandler } from 'express';
import { requireInternalKey } from '../../middleware/internalAuth';
import { parse, idParamSchema } from '../../utils/validate';
import { sendOk } from '../../utils/response';
import { getAttendanceEligibility } from './attendance-integration.service';

const getEligibility: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const eligibility = await getAttendanceEligibility(id);
  sendOk(res, eligibility);
};

/**
 * Mounted at {API_PREFIX}/internal. Protected by X-Internal-Api-Key, NOT by a
 * user JWT — this is a service-to-service endpoint for the attendance service,
 * not something an admin or employee calls from the Admin portal.
 */
export const internalRouter = Router();
internalRouter.get('/employees/:id/attendance-eligibility', requireInternalKey, getEligibility);
