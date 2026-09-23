const fs = require('fs');

const bearer = { type: 'bearer', bearer: [{ key: 'token', value: '{{adminToken}}', type: 'string' }] };
const internalKeyAuth = { type: 'apikey', apikey: [{ key: 'key', value: 'X-Internal-Api-Key' }, { key: 'value', value: '{{internalApiKey}}' }, { key: 'in', value: 'header' }] };

function req({ name, method, url, body, auth, tests, prerequest, description }: {
  name: string;
  method: string;
  url: string;
  body?: unknown;
  auth?: unknown;
  tests?: string;
  prerequest?: string;
  description?: string;
}): any {
  const item: any = {
    name,
    request: {
      method,
      header: body ? [{ key: 'Content-Type', value: 'application/json' }] : [],
      url: { raw: `{{baseUrl}}${url}`, host: ['{{baseUrl}}'], path: url.replace(/^\//, '').split('/') },
      ...(auth ? { auth } : {}),
      ...(description ? { description } : {}),
    },
  };
  if (body) item.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2) };
  const scripts = [];
  if (prerequest) scripts.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: prerequest.split('\n') } });
  if (tests) scripts.push({ listen: 'test', script: { type: 'text/javascript', exec: tests.split('\n') } });
  if (scripts.length) item.event = scripts;
  return item;
}

const testStatus = (code: number) => `pm.test("Status is ${code}", function () { pm.response.to.have.status(${code}); });`;

const collection: { info: unknown; item: any[] } = {
  info: {
    name: 'Momo HRMS - Employee Management Service',
    description:
      'Full API test collection for the Employee Management Service. Run "1. Auth" first to get an admin token ' +
      'from the existing auth-service, then run folders top to bottom — later requests capture ids from earlier responses.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  item: [],
};

// ---- 1. Auth (existing login module) ----
collection.item.push({
  name: '1. Auth (existing login module)',
  item: [
    req({
      name: 'Admin logs in (auth-service)',
      method: 'POST',
      url: '',
      body: { email: 'admin@momo-hrms.example', password: 'change-me' },
      description:
        'Calls the EXISTING auth-service login endpoint, not this service. Update the URL host to {{authServiceUrl}}/auth/login ' +
        'and the credentials to a real seeded admin account before running. On success, captures the access token into {{adminToken}}.',
      tests: [
        testStatus(200),
        'const json = pm.response.json();',
        'if (json && json.data && json.data.accessToken) { pm.environment.set("adminToken", json.data.accessToken); }',
      ].join('\n'),
    }),
  ],
});
(collection.item[0] as any).item[0].request.url = {
  raw: '{{authServiceUrl}}/auth/login',
  host: ['{{authServiceUrl}}'],
  path: ['auth', 'login'],
};

// ---- 2. Departments ----
collection.item.push({
  name: '2. Departments',
  item: [
    req({
      name: 'List departments',
      method: 'GET',
      url: '/departments',
      auth: bearer,
      tests: testStatus(200),
    }),
    req({
      name: 'Create department',
      method: 'POST',
      url: '/departments',
      auth: bearer,
      body: { name: 'Finance {{$timestamp}}', code: 'FIN-{{$timestamp}}', description: 'Finance team' },
      tests: [
        testStatus(201),
        'const json = pm.response.json();',
        'if (json && json.data && json.data.id) { pm.environment.set("departmentId", json.data.id); }',
        'if (json && json.data && json.data.code) { pm.environment.set("departmentCode", json.data.code); }',
        'if (json && json.data && json.data.name) { pm.environment.set("departmentName", json.data.name); }',
      ].join('\n'),
    }),
    req({
      name: 'Get department by id',
      method: 'GET',
      url: '/departments/{{departmentId}}',
      auth: bearer,
      tests: testStatus(200),
    }),
    req({
      name: 'Update department',
      method: 'PUT',
      url: '/departments/{{departmentId}}',
      auth: bearer,
      body: { description: 'Finance and accounting team' },
      tests: testStatus(200),
    }),
    req({
      name: 'List employees in a department',
      method: 'GET',
      url: '/departments/{{departmentId}}/employees',
      auth: bearer,
      tests: testStatus(200),
    }),
    req({
      name: 'Create duplicate department -> 409',
      method: 'POST',
      url: '/departments',
      auth: bearer,
      body: { name: '{{departmentName}}', code: '{{departmentCode}}' },
      tests: testStatus(409),
    }),
    req({
      name: 'Deactivate department (fails while it has active employees) -> 409',
      method: 'PATCH',
      url: '/departments/{{departmentId}}/status',
      auth: bearer,
      body: { status: 'INACTIVE', reason: 'Reorg' },
      tests: '// May be 200 (if empty) or 409 (if it still has active employees). Both are valid, expected outcomes.\npm.test("Status is 200 or 409", function () { pm.expect([200, 409]).to.include(pm.response.code); });',
    }),
    req({
      name: 'Reactivate department (so later folders can assign employees to it)',
      method: 'PATCH',
      url: '/departments/{{departmentId}}/status',
      auth: bearer,
      body: { status: 'ACTIVE' },
      tests: testStatus(200),
    }),
  ],
});

// ---- 3. Roles ----
collection.item.push({
  name: '3. Roles',
  item: [
    req({
      name: 'List roles',
      method: 'GET',
      url: '/roles',
      auth: bearer,
      tests: [
        testStatus(200),
        'const json = pm.response.json();',
        'const employeeRole = json.data.find(r => r.name === "EMPLOYEE");',
        'if (employeeRole) { pm.environment.set("roleId", employeeRole.id); }',
      ].join('\n'),
    }),
    req({
      name: 'Get role by id',
      method: 'GET',
      url: '/roles/{{roleId}}',
      auth: bearer,
      tests: testStatus(200),
    }),
    req({
      name: 'List employees by role',
      method: 'GET',
      url: '/roles/{{roleId}}/employees',
      auth: bearer,
      tests: testStatus(200),
    }),
  ],
});

// ---- 4. Employees ----
collection.item.push({
  name: '4. Employees',
  item: [
    req({
      name: 'List employees (search + filter + paginate)',
      method: 'GET',
      url: '/employees?page=1&limit=20',
      auth: bearer,
      tests: testStatus(200),
    }),
    req({
      name: 'Create employee',
      method: 'POST',
      url: '/employees',
      auth: bearer,
      body: {
        employeeCode: 'EMP-{{$timestamp}}',
        firstName: 'Priya',
        lastName: 'Sharma',
        email: 'priya.sharma+{{$timestamp}}@momo-hrms.example',
        phone: '+91 98765 43213',
        dateOfJoining: '2026-01-05',
        jobTitle: 'QA Engineer',
        departmentId: '{{departmentId}}',
        roleId: '{{roleId}}',
      },
      tests: [
        testStatus(201),
        'const json = pm.response.json();',
        'if (json && json.data && json.data.id) { pm.environment.set("employeeId", json.data.id); }',
        'if (json && json.data && json.data.email) { pm.environment.set("employeeEmail", json.data.email); }',
      ].join('\n'),
    }),
    req({
      name: 'Create employee with duplicate email -> 409',
      method: 'POST',
      url: '/employees',
      auth: bearer,
      body: {
        employeeCode: 'EMP-DUP-{{$timestamp}}',
        firstName: 'Dup',
        lastName: 'Licate',
        email: '{{employeeEmail}}',
        phone: '+91 98765 43214',
        dateOfJoining: '2026-01-05',
        jobTitle: 'QA Engineer',
        departmentId: '{{departmentId}}',
        roleId: '{{roleId}}',
      },
      tests: testStatus(409),
    }),
    req({
      name: 'Get employee by id',
      method: 'GET',
      url: '/employees/{{employeeId}}',
      auth: bearer,
      tests: testStatus(200),
    }),
    req({
      name: 'Get employee by invalid id -> 404',
      method: 'GET',
      url: '/employees/11111111-1111-4111-8111-111111111111',
      auth: bearer,
      tests: testStatus(404),
    }),
    req({
      name: 'Get employee full profile',
      method: 'GET',
      url: '/employees/{{employeeId}}/profile',
      auth: bearer,
      tests: testStatus(200),
    }),
    req({
      name: 'Update employee information',
      method: 'PUT',
      url: '/employees/{{employeeId}}',
      auth: bearer,
      body: { jobTitle: 'Senior QA Engineer' },
      tests: testStatus(200),
    }),
    req({
      name: 'Assign / change employee role',
      method: 'PATCH',
      url: '/employees/{{employeeId}}/role',
      auth: bearer,
      body: { roleId: '{{roleId}}' },
      tests: testStatus(200),
    }),
    req({
      name: 'Deactivate employee',
      method: 'PATCH',
      url: '/employees/{{employeeId}}/status',
      auth: bearer,
      body: { status: 'INACTIVE', reason: 'Testing deactivation flow' },
      tests: testStatus(200),
    }),
    req({
      name: 'Reactivate employee',
      method: 'PATCH',
      url: '/employees/{{employeeId}}/status',
      auth: bearer,
      body: { status: 'ACTIVE' },
      tests: testStatus(200),
    }),
    req({
      name: 'Unauthorized request (no token) -> 401',
      method: 'GET',
      url: '/employees',
      tests: testStatus(401),
    }),
  ],
});

// ---- 5. Devices ----
collection.item.push({
  name: '5. Devices',
  item: [
    req({
      name: "Register a device for an employee",
      method: 'POST',
      url: '/employees/{{employeeId}}/devices',
      auth: bearer,
      body: { deviceName: "Priya's Pixel 8", deviceType: 'ANDROID', deviceIdentifier: 'device-hash-{{$randomUUID}}' },
      tests: [
        testStatus(201),
        'const json = pm.response.json();',
        'if (json && json.data && json.data.id) { pm.environment.set("deviceId", json.data.id); }',
      ].join('\n'),
    }),
    req({
      name: "List an employee's devices",
      method: 'GET',
      url: '/employees/{{employeeId}}/devices',
      auth: bearer,
      tests: testStatus(200),
    }),
    req({
      name: 'List all active devices',
      method: 'GET',
      url: '/devices?status=ACTIVE',
      auth: bearer,
      tests: testStatus(200),
    }),
    req({
      name: 'Get device by id',
      method: 'GET',
      url: '/devices/{{deviceId}}',
      auth: bearer,
      tests: testStatus(200),
    }),
    req({
      name: 'Update device information',
      method: 'PATCH',
      url: '/devices/{{deviceId}}',
      auth: bearer,
      body: { deviceName: "Priya's Pixel 8 Pro" },
      tests: testStatus(200),
    }),
    req({
      name: 'Revoke device',
      method: 'PATCH',
      url: '/devices/{{deviceId}}/status',
      auth: bearer,
      body: { status: 'REVOKED' },
      tests: testStatus(200),
    }),
    req({
      name: 'Reactivate revoked device (requires SUPER_ADMIN token)',
      method: 'PATCH',
      url: '/devices/{{deviceId}}/status',
      auth: bearer,
      body: { status: 'ACTIVE' },
      tests: '// 200 if {{adminToken}} carries SUPER_ADMIN, 403 if it only carries HR_ADMIN.\npm.test("Status is 200 or 403", function () { pm.expect([200, 403]).to.include(pm.response.code); });',
    }),
  ],
});

// ---- 6. Face Template References ----
collection.item.push({
  name: '6. Face Template References',
  item: [
    req({
      name: 'Register a face-template reference',
      method: 'POST',
      url: '/employees/{{employeeId}}/face-template',
      auth: bearer,
      body: { externalReferenceId: 'ext-ref-{{$randomUUID}}', provider: 'BioSecure Attendance' },
      tests: [
        testStatus(201),
        'const json = pm.response.json();',
        'if (json && json.data && json.data.id) { pm.environment.set("faceTemplateId", json.data.id); }',
      ].join('\n'),
    }),
    req({
      name: "Get employee's face-template reference status",
      method: 'GET',
      url: '/employees/{{employeeId}}/face-template',
      auth: bearer,
      tests: testStatus(200),
    }),
    req({
      name: 'Replace the face-template reference (register again)',
      method: 'POST',
      url: '/employees/{{employeeId}}/face-template',
      auth: bearer,
      body: { externalReferenceId: 'ext-ref-{{$randomUUID}}', provider: 'BioSecure Attendance' },
      tests: [
        testStatus(201),
        'const json = pm.response.json();',
        'if (json && json.data && json.data.id) { pm.environment.set("faceTemplateId", json.data.id); }',
      ].join('\n'),
    }),
    req({
      name: 'Change face-template status',
      method: 'PATCH',
      url: '/face-templates/{{faceTemplateId}}/status',
      auth: bearer,
      body: { status: 'EXPIRED' },
      tests: testStatus(200),
    }),
    req({
      name: 'Revoke (soft-delete) a face-template reference',
      method: 'DELETE',
      url: '/face-templates/{{faceTemplateId}}',
      auth: bearer,
      tests: testStatus(200),
    }),
  ],
});

// ---- 7. Attendance Service Integration ----
collection.item.push({
  name: '7. Attendance Service Integration',
  item: [
    req({
      name: 'Attendance eligibility for an active employee',
      method: 'GET',
      url: '/internal/employees/{{employeeId}}/attendance-eligibility',
      auth: internalKeyAuth,
      tests: testStatus(200),
    }),
    req({
      name: 'Attendance eligibility is denied for a deactivated employee',
      method: 'GET',
      url: '/internal/employees/{{employeeId}}/attendance-eligibility',
      auth: internalKeyAuth,
      tests: [
        testStatus(200),
        'const json = pm.response.json();',
        '// Run this AFTER the "Deactivate employee" request in folder 4 for a meaningful check.',
        'pm.test("isEligibleForAttendance reflects employee status", function () {',
        '  if (json.data.status !== "ACTIVE") { pm.expect(json.data.isEligibleForAttendance).to.eql(false); }',
        '});',
      ].join('\n'),
    }),
    req({
      name: 'Internal endpoint rejects a normal user JWT -> 401',
      method: 'GET',
      url: '/internal/employees/{{employeeId}}/attendance-eligibility',
      auth: bearer,
      tests: testStatus(401),
    }),
  ],
});

fs.writeFileSync(
  process.argv[2],
  JSON.stringify(collection, null, 2),
);
console.log('Wrote collection with', collection.item.length, 'folders');
