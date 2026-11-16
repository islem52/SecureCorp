const http = require('http');

async function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function sendRequest(stepName, url, method, headers, body) {
  console.log(`\n======================================================`);
  console.log(`[TEST] ${stepName}`);
  console.log(`[REQUEST] ${method} ${url}`);
  if (headers && headers.Authorization) {
    console.log(`[HEADERS] Authorization: ${headers.Authorization.substring(0, 30)}... [TRUNCATED FOR LOGS]`);
  }
  if (body) console.log(`[BODY] ${JSON.stringify(body)}`);

  const res = await request(url, { method, headers }, body);

  console.log(`\n[RESPONSE STATUS] ${res.status}`);
  console.log(`[RESPONSE DATA]\n${JSON.stringify(res.data, null, 2)}`);
  return res.data;
}

(async () => {
  try {
    console.log("Starting Automated API Integration Tests...\n");

    await sendRequest(
      "0a. Signing up new user 'islemmmmmm'",
      "http://localhost:3000/signup",
      "POST",
      { 'Content-Type': 'application/json' },
      { username: 'islemmmmm', password: 'password123', role: 'Employee', department: 'finance', clearance: 'secret', location: 'internal' }
    );

    const loginIslemRes = await sendRequest(
      "0b. Logging in as newly created user 'islemmmmm'",
      "http://localhost:3000/login",
      "POST",
      { 'Content-Type': 'application/json' },
      { username: 'islemmmmm', password: 'password123' }
    );

    const stIslemRes = await sendRequest(
      "0c. 'islemmmmm' requesting a Finance Service Ticket",
      "http://localhost:3000/request-ticket",
      "POST",
      { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginIslemRes.tgt}` },
      { service: 'finance' }
    );

    await sendRequest(
      "0d. 'islemmmmm' accessing Secret Finance Resource (Request is VALIDATED)",
      "http://localhost:3003/resource/3",
      "GET",
      { 'Authorization': `Bearer ${stIslemRes.serviceTicket}` }
    );

    await sendRequest(
      "0e. 'islemmmmm' attempting to Write to Finance Resource (Request is DENIED by RBAC)",
      "http://localhost:3003/resource",
      "POST",
      { 'Content-Type': 'application/json', 'Authorization': `Bearer ${stIslemRes.serviceTicket}` },
      { id: '99', classification: 'public' }
    );

    await sendRequest(
      "0b. Signing up user 'ryad' with missing Password (Should FAIL)",
      "http://localhost:3000/signup",
      "POST",
      { 'Content-Type': 'application/json' },
      { username: 'ryad', role: 'Manager' }
    );

    const loginRes = await sendRequest(
      "1. Logging in as Kimiko (Employee, Finance, Public Clearance)",
      "http://localhost:3000/login",
      "POST",
      { 'Content-Type': 'application/json' },
      { username: 'Kimiko', password: 'password123' }
    );
    const tgt = loginRes.tgt;

    const stRes = await sendRequest(
      "2. Exchanging TGT for Finance Service Ticket",
      "http://localhost:3000/request-ticket",
      "POST",
      { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tgt}` },
      { service: 'finance' }
    );
    const st = stRes.serviceTicket;

    await sendRequest(
      "3. Kimiko accessing Public Finance Resource (Should SUCCEED)",
      "http://localhost:3003/resource/1",
      "GET",
      { 'Authorization': `Bearer ${st}` }
    );

    const loginMohamedRes = await sendRequest(
      "4. Logging in as Mohamed (Employee, HR, Public Clearance)",
      "http://localhost:3000/login",
      "POST",
      { 'Content-Type': 'application/json' },
      { username: 'Mohamed', password: 'password123' }
    );

    const stMohamedRes = await sendRequest(
      "4b. Exchanging TGT for Finance Service Ticket for Mohamed",
      "http://localhost:3000/request-ticket",
      "POST",
      { 'Content-Type': 'application/json', 'Authorization': `Bearer ${loginMohamedRes.tgt}` },
      { service: 'finance' }
    );

    await sendRequest(
      "5. Mohamed accessing Public Finance Resource (Should FAIL ABAC Cross-Department)",
      "http://localhost:3003/resource/1",
      "GET",
      { 'Authorization': `Bearer ${stMohamedRes.serviceTicket}` }
    );

    await sendRequest(
      "6. Kimiko attempting to Write/Create a resource (Should FAIL RBAC)",
      "http://localhost:3003/resource",
      "POST",
      { 'Content-Type': 'application/json', 'Authorization': `Bearer ${st}` },
      { id: '99', classification: 'public' }
    );

    console.log("\n======================================================");
    console.log("All API Integration Tests Completed Successfully!");
  } catch (e) {
    console.error("Test execution failed:", e.message);
  }
})();
