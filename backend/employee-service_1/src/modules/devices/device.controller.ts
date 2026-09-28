import type { RequestHandler } from 'express';
import { getActor } from '../../middleware/authenticate';
import { parse, idParamSchema } from '../../utils/validate';
import { sendOk, sendPage } from '../../utils/response';
import {
  registerDeviceSchema,
  updateDeviceSchema,
  deviceStatusSchema,
  listDevicesQuerySchema,
  listEmployeeDevicesQuerySchema,
} from './device.validation';
import * as deviceService from './device.service';

export const registerDevice: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const body = parse(registerDeviceSchema, req.body);
  const device = await deviceService.registerDevice(id, body, getActor(req));
  sendOk(res, device, 201);
};

export const listEmployeeDevices: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const query = parse(listEmployeeDevicesQuerySchema, req.query);
  const { data, meta } = await deviceService.listEmployeeDevices(id, query);
  sendPage(res, data, meta);
};

export const listDevices: RequestHandler = async (req, res) => {
  const query = parse(listDevicesQuerySchema, req.query);
  const { data, meta } = await deviceService.listDevices(query);
  sendPage(res, data, meta);
};

export const getDevice: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const device = await deviceService.getDeviceById(id);
  sendOk(res, device);
};

export const updateDevice: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const body = parse(updateDeviceSchema, req.body);
  const device = await deviceService.updateDevice(id, body, getActor(req));
  sendOk(res, device);
};

export const changeDeviceStatus: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const body = parse(deviceStatusSchema, req.body);
  const device = await deviceService.changeDeviceStatus(id, body.status, getActor(req));
  sendOk(res, device);
};
