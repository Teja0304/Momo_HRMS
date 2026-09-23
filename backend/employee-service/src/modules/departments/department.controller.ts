import type { RequestHandler } from 'express';
import { getActor } from '../../middleware/authenticate';
import { parse, idParamSchema } from '../../utils/validate';
import { sendOk, sendPage } from '../../utils/response';
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  departmentStatusSchema,
  listDepartmentsQuerySchema,
  listDepartmentEmployeesQuerySchema,
} from './department.validation';
import * as departmentService from './department.service';

export const listDepartments: RequestHandler = async (req, res) => {
  const query = parse(listDepartmentsQuerySchema, req.query);
  const { data, meta } = await departmentService.listDepartments(query);
  sendPage(res, data, meta);
};

export const getDepartment: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const department = await departmentService.getDepartmentById(id);
  sendOk(res, department);
};

export const createDepartment: RequestHandler = async (req, res) => {
  const body = parse(createDepartmentSchema, req.body);
  const department = await departmentService.createDepartment(body, getActor(req));
  sendOk(res, department, 201);
};

export const updateDepartment: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const body = parse(updateDepartmentSchema, req.body);
  const department = await departmentService.updateDepartment(id, body, getActor(req));
  sendOk(res, department);
};

export const changeDepartmentStatus: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const body = parse(departmentStatusSchema, req.body);
  const department = await departmentService.changeDepartmentStatus(id, body.status, body.reason, getActor(req));
  sendOk(res, department);
};

export const listDepartmentEmployees: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const query = parse(listDepartmentEmployeesQuerySchema, req.query);
  const { data, meta } = await departmentService.listDepartmentEmployees(id, query);
  sendPage(res, data, meta);
};
