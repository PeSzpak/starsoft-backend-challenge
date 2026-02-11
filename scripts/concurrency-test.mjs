#!/usr/bin/env node

const baseUrl = process.env.API_URL ?? 'http://localhost:3000';
const requests = Number(process.env.REQUESTS ?? '10');
const seat = process.env.SEAT_NUMBER ?? 'A1';
const userPrefix = process.env.USER_PREFIX ?? 'user';

async function createSession() {
  const now = new Date();
  now.setHours(now.getHours() + 1);

  const payload = {
    movieTitle: 'Concurrency Test Movie',
    roomName: 'Room Lock',
    startsAt: now.toISOString(),
    priceCents: 2500,
    totalSeats: 16,
  };

  const response = await fetch(`${baseUrl}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Failed to create session: ${response.status} ${body}`);
  }

  const session = await response.json();
  return Number(session.id);
}

async function run() {
  const providedSessionId = process.env.SESSION_ID;
  const sessionId = providedSessionId ? Number(providedSessionId) : await createSession();

  if (!Number.isFinite(sessionId) || sessionId <= 0) {
    throw new Error('Invalid SESSION_ID');
  }

  console.log(`API_URL=${baseUrl}`);
  console.log(`SESSION_ID=${sessionId}`);
  console.log(`REQUESTS=${requests}`);
  console.log(`SEAT=${seat}`);

  const startedAt = Date.now();

  const attempts = Array.from({ length: requests }, (_, index) => {
    const payload = {
      sessionId,
      userId: `${userPrefix}-${index + 1}`,
      seatNumbers: [seat],
    };

    return fetch(`${baseUrl}/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
      .then(async (response) => ({
        ok: response.ok,
        status: response.status,
        body: await response.text(),
      }))
      .catch((error) => ({
        ok: false,
        status: 0,
        body: error.message,
      }));
  });

  const results = await Promise.all(attempts);
  const elapsedMs = Date.now() - startedAt;

  const success = results.filter((result) => result.ok).length;
  const conflict = results.filter((result) => result.status === 409).length;
  const otherFailures = results.filter(
    (result) => !result.ok && result.status !== 409,
  ).length;

  console.log('\nResult summary');
  console.log(`success=${success}`);
  console.log(`conflict_409=${conflict}`);
  console.log(`other_failures=${otherFailures}`);
  console.log(`elapsed_ms=${elapsedMs}`);

  if (success > 0) {
    const firstSuccess = results.find((result) => result.ok);
    console.log('\nFirst success payload');
    console.log(firstSuccess?.body ?? '');
  }

  if (otherFailures > 0) {
    console.log('\nUnexpected failures');
    results
      .filter((result) => !result.ok && result.status !== 409)
      .forEach((result, index) => {
        console.log(`#${index + 1} status=${result.status} body=${result.body}`);
      });
  }

  if (success !== 1) {
    process.exitCode = 1;
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
