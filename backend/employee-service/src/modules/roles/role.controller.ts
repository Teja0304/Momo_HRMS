import type { RequestHandler } from 'express';
import { getActor } from '../../middleware/authenticate';
import { parse, idParamSchema } from '../../utils/validate';
import { sendOk, sendPage } from '../../utils/response';
import { changeEmployeeRoleSchema, listEmployeesByRoleQuerySchema } from './role.validation';
import * as roleService from './role.service';

export const listRoles: RequestHandler = async (_req, res) => {
  const roles = await roleService.listRoles();
  sendOk(res, roles);
};

export const getRole: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const role = await roleService.getRoleById(id);
  sendOk(res, role);
};

export const listEmployeesByRole: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const query = parse(listEmployeesByRoleQuerySchema, req.query);
  const { data, meta } = await roleService.listEmployeesByRole(id, query);
  sendPage(res, data, meta);
};

export const changeEmployeeRole: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const body = parse(changeEmployeeRoleSchema, req.body);
  const employee = await roleService.changeEmployeeRole(id, body.roleId, getActor(req));
  sendOk(res, employee);
};
