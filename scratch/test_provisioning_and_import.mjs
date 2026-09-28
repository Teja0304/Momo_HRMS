// scratch/test_provisioning_and_import.mjs
import assert from 'node:assert';

const AUTH_URL = 'http://localhost:3001/api/v1';
const EMP_URL = 'http://localhost:5000/api/v1';

async function testAll() {
  console.log('--- 1. Login as SuperAdmin ---');
  const loginRes = await fetch(`${AUTH_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'admin@company.com',
      password: 'ChangeMe123!',
    }),
  });

  const loginData = await loginRes.json();
  assert.strictEqual(loginRes.status, 200, `Login failed: ${JSON.stringify(loginData)}`);
  const accessToken = loginData.accessToken;
  console.log('SuperAdmin logged in successfully!');

  console.log('\n--- 2. Fetch Departments & Roles ---');
  const deptsRes = await fetch(`${EMP_URL}/departments`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const deptsData = await deptsRes.json();
  const departments = deptsData.data;
  assert.ok(departments.length > 0, 'No departments found');
  const dept = departments[0];

  const rolesRes = await fetch(`${EMP_URL}/roles`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const rolesData = await rolesRes.json();
  const roles = rolesData.data;
  assert.ok(roles.length > 0, 'No roles found');
  const role = roles.find((r) => r.name === 'EMPLOYEE') || roles[0];
  console.log(`Using Department: ${dept.name} (${dept.id}), Role: ${role.name} (${role.id})`);

  console.log('\n--- 3. Case B: Create Employee with Account Provisioning ---');
  const uniqueNum = Date.now().toString().slice(-5);
  const testCode = `PROV-${uniqueNum}`;
  const testEmail = `employee.${uniqueNum}@momo-hrms.example`;
  const testPersonalEmail = `personal.${uniqueNum}@example.com`;

  const createRes = await fetch(`${EMP_URL}/employees`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      employeeCode: testCode,
      firstName: 'Rahul',
      lastName: 'Sharma',
      email: testEmail,
      personalEmail: testPersonalEmail,
      phone: '+91 98765 11111',
      dateOfJoining: '2025-01-10',
      jobTitle: 'Backend Developer',
      departmentId: dept.id,
      roleId: role.id,
      provisionAccount: true,
    }),
  });

  const createData = await createRes.json();
  console.log('Create Employee Response Status:', createRes.status);
  assert.strictEqual(createRes.status, 201, `Failed to create employee: ${JSON.stringify(createData)}`);
  const createdEmp = createData.data;
  console.log('Created Employee ID:', createdEmp.id);
  console.log('Employee personalEmail:', createdEmp.personalEmail);
  console.log('Employee hasAccount:', createdEmp.hasAccount);
  console.log('Employee userId (auth-service link):', createdEmp.userId);
  assert.strictEqual(createdEmp.personalEmail, testPersonalEmail);
  assert.ok(createdEmp.hasAccount, 'Employee hasAccount should be true');
  assert.ok(createdEmp.userId, 'Employee userId should be linked');

  console.log('\n--- 4. Test Resend Credentials / Password Reset ---');
  const resendRes = await fetch(`${EMP_URL}/employees/${createdEmp.id}/resend-credentials`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
  const resendData = await resendRes.json();
  console.log('Resend Credentials Response:', resendData);
  assert.strictEqual(resendRes.status, 200, `Resend failed: ${JSON.stringify(resendData)}`);
  assert.strictEqual(resendData.data.success, true);
  assert.strictEqual(resendData.data.deliveredTo, testPersonalEmail);

  console.log('\n--- 5. Case A: Download CSV Import Template ---');
  const templateRes = await fetch(`${EMP_URL}/employees/import/template`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  assert.strictEqual(templateRes.status, 200);
  const templateCsv = await templateRes.text();
  assert.ok(templateCsv.includes('employeeCode,firstName,lastName,email'));
  console.log('Template downloaded successfully! First 100 chars:\n', templateCsv.slice(0, 100));

  console.log('\n--- 6. Case A: Validate Bulk CSV Upload ---');
  const importCodeNew = `BULK-${uniqueNum}-A`;
  const importCodeUpdate = createdEmp.employeeCode; // Existing employee to trigger update

  const csvContent = [
    'employeeCode,firstName,lastName,email,personalEmail,phone,dateOfJoining,jobTitle,department,role',
    `${importCodeNew},Sunil,Gavaskar,sunil.${uniqueNum}@momo-hrms.example,sunil.personal@example.com,+91 98765 22222,2025-02-01,Test Analyst,${dept.code},EMPLOYEE`,
    `${importCodeUpdate},RahulUpdated,Sharma,${testEmail},${testPersonalEmail},+91 98765 11111,2025-01-10,Lead Backend Developer,${dept.code},EMPLOYEE`,
  ].join('\n');

  const formData = new FormData();
  formData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'test_import.csv');

  const valRes = await fetch(`${EMP_URL}/employees/import/validate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: formData,
  });
  const valData = await valRes.json();
  console.log('Validation Summary:', valData);
  assert.strictEqual(valRes.status, 200, `Validation failed: ${JSON.stringify(valData)}`);
  assert.strictEqual(valData.data.validNewCount, 1, 'Expected 1 valid new row');
  assert.strictEqual(valData.data.validUpdateCount, 1, 'Expected 1 valid update row');

  console.log('\n--- 7. Case A: Execute Bulk Import ---');
  const execFormData = new FormData();
  execFormData.append('file', new Blob([csvContent], { type: 'text/csv' }), 'test_import.csv');
  execFormData.append('provisionAccounts', 'true');

  const execRes = await fetch(`${EMP_URL}/employees/import`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: execFormData,
  });
  const execData = await execRes.json();
  console.log('Import Execution Result:', execData);
  assert.strictEqual(execRes.status, 200, `Execution failed: ${JSON.stringify(execData)}`);
  assert.strictEqual(execData.data.created, 1, 'Expected 1 created record');
  assert.strictEqual(execData.data.updated, 1, 'Expected 1 updated record');

  console.log('\n=== ALL TESTS PASSED SUCCESSFULLY! ===');
}

testAll().catch((err) => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
