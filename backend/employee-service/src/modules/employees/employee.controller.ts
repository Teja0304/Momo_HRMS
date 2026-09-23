import type { RequestHandler } from 'express';
import { getActor } from '../../middleware/authenticate';
import { parse, idParamSchema } from '../../utils/validate';
import { sendOk, sendPage } from '../../utils/response';
import { createEmployeeSchema, updateEmployeeSchema, employeeStatusSchema, listEmployeesQuerySchema } from './employee.validation';
import * as employeeService from './employee.service';

export const listEmployees: RequestHandler = async (req, res) => {
  const query = parse(listEmployeesQuerySchema, req.query);
  const { data, meta } = await employeeService.listEmployees(query);
  sendPage(res, data, meta);
};

export const getEmployee: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const employee = await employeeService.getEmployeeById(id, getActor(req));
  sendOk(res, employee);
};

export const getEmployeeProfile: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const profile = await employeeService.getEmployeeProfile(id, getActor(req));
  sendOk(res, profile);
};

export const createEmployee: RequestHandler = async (req, res) => {
  const body = parse(createEmployeeSchema, req.body);
  const employee = await employeeService.createEmployee(body, getActor(req));
  sendOk(res, employee, 201);
};

export const updateEmployee: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const body = parse(updateEmployeeSchema, req.body);
  const employee = await employeeService.updateEmployee(id, body, getActor(req));
  sendOk(res, employee);
};

export const changeEmployeeStatus: RequestHandler = async (req, res) => {
  const { id } = parse(idParamSchema, req.params);
  const body = parse(employeeStatusSchema, req.body);
  const employee = await employeeService.changeEmployeeStatus(id, body.status, body.reason, getActor(req));
  sendOk(res, employee);
};
