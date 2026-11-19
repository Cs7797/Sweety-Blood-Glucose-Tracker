import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const baseUrl = process.env.DOCKER_URL || "http://localhost:8080";

const request = async (path, method = "GET", body, token) => {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
};

const frontend = await fetch(baseUrl);
assert.equal(frontend.status, 200);
const html = await frontend.text();
assert.ok(html.includes('<div id="root"></div>'));
const asset = html.match(/src="(\/assets\/[^"]+\.js)"/);
assert.ok(asset);
assert.equal((await fetch(`${baseUrl}${asset[1]}`)).status, 200);
const route = await fetch(`${baseUrl}/reports`);
assert.equal(route.status, 200);
assert.equal(await route.text(), html);
assert.equal((await request("/api/user/data")).status, 401);

const email = `docker-${randomUUID()}@example.com`;
const password = "DockerCheck123!";
const registered = await request("/api/user/register", "POST", { name: "Docker Test", email, password });
assert.equal(registered.status, 201);
const login = await request("/api/user/login", "POST", { email, password });
assert.equal(login.status, 200);
const token = login.data.token;
const user = await request("/api/user/data", "GET", undefined, token);
assert.equal(user.data.user.email, email);

const body = { date: "2025-01-01", slot: "Morning (fasting)", glucose: 110.5 };
const created = await request("/api/readings", "POST", body, token);
assert.equal(created.status, 201);
const id = created.data.reading.id;
const updated = await request(`/api/readings/${id}`, "PUT", { ...body, glucose: 130 }, token);
assert.equal(updated.status, 200);
const readings = await request("/api/readings?date=2025-01-01&page=1&limit=1", "GET", undefined, token);
assert.equal(readings.data.pagination.total, 1);
assert.equal(readings.data.readings[0].glucose, 130);
const report = await request("/api/reports/daily?date=2025-01-01", "GET", undefined, token);
assert.equal(report.data.report.average, 130);
assert.equal(report.data.report.count, 1);
assert.equal((await request(`/api/readings/${id}`, "DELETE", undefined, token)).status, 200);
const empty = await request("/api/readings", "GET", undefined, token);
assert.equal(empty.data.pagination.total, 0);

process.stdout.write("Docker check passed: frontend assets, frontend routing, API proxy, authentication, reading CRUD, pagination and daily report\n");
