import type { RequestHandler } from 'express';
import { getActor } from '../../middleware/authenticate';
import { parse, idParamSchema } from '../../utils/validate';
import { sendOk } from '../../utils/response';
import { registerFaceTemplateSchema, faceTemplateStatusSchema } from './face-template.validation';
import * as faceTemplateService from './face-template.service';

export const registerFaceTemplate: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const body = parse(registerFaceTemplateSchema, req.body);
  const template = await faceTemplateService.registerOrReplaceFaceTemplate(id, body, getActor(req));
  sendOk(res, template, 201);
};

export const getEmployeeFaceTemplateStatus: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const status = await faceTemplateService.getEmployeeFaceTemplateStatus(id);
  sendOk(res, status);
};

export const changeFaceTemplateStatus: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const body = parse(faceTemplateStatusSchema, req.body);
  const template = await faceTemplateService.changeFaceTemplateStatus(id, body.status, getActor(req));
  sendOk(res, template);
};

export const revokeFaceTemplate: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const template = await faceTemplateService.revokeFaceTemplate(id, getActor(req));
  sendOk(res, template);
};
