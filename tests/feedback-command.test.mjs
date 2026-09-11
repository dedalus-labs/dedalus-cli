import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
const root = resolve(process.env.FEEDBACK_PACKAGE_ROOT ?? ".");
const { feedbackIdempotencyKey } = await import(
	pathToFileURL(join(root, "dist/esm/feedback/command.js"))
);
const { diagnosticScope } = await import(
	pathToFileURL(join(root, "dist/esm/feedback/diagnostics.js"))
);
const receipt = "01973f7b7cf6726a9a9f4f37d4b47a21";

test("invariant idempotency keys match the server UUIDv7 contract", () => {
	const keys = new Set(Array.from({ length: 100 }, feedbackIdempotencyKey));
	assert.equal(keys.size, 100);
	for (const key of keys) assert.match(key, /^[0-9a-f]{12}7[0-9a-f]{3}[89ab][0-9a-f]{15}$/);
});

const runCLI = async (args, env = {}) => {
	const child = spawn(process.execPath, [join(root, "dist/esm/bin.js"), ...args], {
		env: {
			PATH: process.env.PATH,
			HOME: process.env.HOME,
			USERPROFILE: process.env.USERPROFILE,
			...env,
		},
	});
	let stdout = "",
		stderr = "";
	child.stdout.on("data", (chunk) => {
		stdout += chunk;
	});
	child.stderr.on("data", (chunk) => {
		stderr += chunk;
	});
	const code = await new Promise((resolve, reject) => {
		child.on("error", reject);
		child.on("close", resolve);
	});
	return { code, stdout, stderr };
};

test("invariant organization selection never turns a request receipt into an outbound request ID", async (t) => {
	let headers;
	const server = createServer((req, res) => {
		headers = req.headers;
		req.resume();
		res.writeHead(201, { "content-type": "application/json" });
		res.end(JSON.stringify({ id: "fb_" + receipt, source: "cli", debug: { included: false } }));
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(() => server.close());
	const result = await runCLI(
		[
			"feedback",
			"organization check",
			"--include-logs=false",
			"--api-key",
			"test-key",
			"--x-dedalus-org-id",
			"org-current",
			"--base-url",
			"http://127.0.0.1:" + server.address().port,
		],
		{
			DEDALUS_CUSTOM_HEADERS: "x-request-id: " + receipt,
		},
	);
	assert.equal(result.code, 0, result.stderr);
	assert.equal(headers["x-dedalus-org-id"], "org-current");
	assert.equal(headers["x-request-id"], undefined);
	assert.notEqual(
		diagnosticScope({ apiKey: "key", dedalusOrgID: "org-current" }),
		diagnosticScope({ apiKey: "key", dedalusOrgID: "org-other" }),
	);
});

test("invariant installed CLI sends a server-compatible multipart manifest", async (t) => {
	let received;
	const server = createServer(async (req, res) => {
		const chunks = [];
		for await (const chunk of req) chunks.push(chunk);
		const wire = new Request("http://fixture/v1/feedback", {
			method: "POST",
			headers: req.headers,
			body: Buffer.concat(chunks),
		});
		received = await wire.formData();
		res.writeHead(201, { "content-type": "application/json" });
		res.end(JSON.stringify({ id: "fb_" + receipt, source: "cli", debug: { included: true } }));
	});
	await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
	t.after(() => server.close());
	const result = await runCLI([
		"feedback",
		"package attachment check",
		"--include-logs=true",
		"--api-key",
		"test-key",
		"--base-url",
		"http://127.0.0.1:" + server.address().port,
		"--format",
		"json",
	]);
	assert.equal(result.code, 0, result.stderr);
	const metadata = JSON.parse(received.get("metadata"));
	const files = received.getAll("debug_files");
	assert.equal(metadata.debug.included, true);
	assert.equal(files.length, metadata.debug.files.length);
	assert.ok(files.length > 0 && files.length <= 4);
	for (const file of files) {
		const bytes = Buffer.from(await file.arrayBuffer());
		const manifest = metadata.debug.files.find((entry) => entry.filename === file.name);
		assert.equal(manifest.size_bytes, bytes.length);
		assert.equal(manifest.sha256, createHash("sha256").update(bytes).digest("hex"));
		assert.equal(manifest.format, file.type);
		assert.doesNotMatch(bytes.toString(), /test-key|Authorization|Bearer/);
	}
});

for (const [status, exitCode] of [
	[401, 10],
	[429, 12],
	[422, 13],
]) {
	test(
		"invariant installed CLI reports HTTP " + status + " without claiming acceptance",
		async (t) => {
			const envelope = {
				error_code: status === 429 ? "RATE_LIMITED" : "INVALID_REQUEST",
				message: "fixture rejection",
				retryable: status === 429,
				...(status === 429
					? { retry_after_ms: 1000, details: { rate_limit_scope: "organization" } }
					: {}),
			};
			const server = createServer((req, res) => {
				req.resume();
				res.writeHead(status, { "content-type": "application/json" });
				res.end(JSON.stringify(envelope));
			});
			await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
			t.after(() => server.close());
			const result = await runCLI([
				"feedback",
				"rejection check",
				"--include-logs=false",
				"--api-key",
				"test-key",
				"--base-url",
				"http://127.0.0.1:" + server.address().port,
				"--max-retries",
				"0",
				"--format",
				"json",
			]);
			assert.equal(result.code, exitCode, result.stderr);
			assert.equal(result.stdout, "");
			assert.match(result.stderr, /fixture rejection/);
			const error = JSON.parse(result.stderr);
			assert.equal(error.status, status);
			assert.deepEqual(error.body, envelope);
		},
	);
}

test('invariant installed CLI retries one submission with the same idempotency key', async (t) => {
  const requests = [];
  const server = createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({ headers: req.headers, body, path: req.url });
    res.setHeader('content-type', 'application/json');
    if (requests.length === 1) {
      res.writeHead(503, { 'retry-after-ms': '1' });
      res.end('{"error":{"message":"retry fixture"}}');
    } else {
      res.writeHead(201);
      res.end(
        JSON.stringify({
          id: 'fb_' + receipt,
          source: 'cli',
          reported_request_id: null,
          debug: { included: false },
        }),
      );
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => server.close());
  const result = await runCLI([
    'feedback',
    'package retry check',
    '--include-logs=false',
    '--api-key',
    'test-key',
    '--base-url',
    'http://127.0.0.1:' + server.address().port,
    '--format',
    'json',
  ]);
  assert.equal(result.code, 0, result.stderr);
  assert.equal(requests.length, 2);
  assert.equal(requests[0].headers['idempotency-key'], requests[1].headers['idempotency-key']);
  assert.equal(requests[0].body, requests[1].body);
  assert.equal(requests[0].path, '/v1/feedback');
  assert.equal(requests[0].headers['x-dedalus-cli-command'], 'dedalus feedback');
  assert.equal(requests[0].headers['x-request-id'], undefined);
  assert.equal(JSON.parse(requests[0].body).debug.included, false);
  assert.equal(JSON.parse(result.stdout).id, 'fb_' + receipt);
});

test('invariant invalid include-logs values fail before submission', async () => {
  const result = await runCLI(['feedback', 'invalid mode', '--include-logs=maybe']);
  assert.equal(result.code, 2);
});

for (const failsDecoding of [false, true]) {
  test('invariant feedback follows the terminal command outcome after HTTP responses: ' + (failsDecoding ? 'decoding failure' : 'recovered retry'), async (t) => {
    const home = mkdtempSync(join(tmpdir(), 'dedalus-command-outcome-'));
    t.after(() => rmSync(home, { recursive: true, force: true }));
    let attempts = 0;
    let report;
    const server = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      if (req.url === '/v1/feedback') {
        const wire = new Request('http://fixture/v1/feedback', {
          method: 'POST', headers: req.headers, body: Buffer.concat(chunks),
        });
        report = req.headers['content-type'].startsWith('multipart/')
          ? JSON.parse((await wire.formData()).get('metadata'))
          : await wire.json();
        res.writeHead(201, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ id: 'fb_' + receipt, source: 'cli', debug: report.debug }));
        return;
      }
      attempts++;
      res.setHeader('content-type', 'application/json');
      res.setHeader('x-request-id', receipt);
      if (!failsDecoding && attempts === 1) {
        res.writeHead(503, { 'retry-after-ms': '1' });
        res.end('{"message":"retry fixture"}');
      } else {
        res.writeHead(200);
        res.end(failsDecoding ? '{' : '{"data":[]}');
      }
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());
    const options = ['--api-key', 'test-key', '--base-url', 'http://127.0.0.1:' + server.address().port];
    const command = await runCLI(['machines', 'list', ...options], { HOME: home });
    assert.equal(command.code, failsDecoding ? 1 : 0, command.stderr);
    assert.equal(attempts, failsDecoding ? 1 : 2);
    const feedback = await runCLI([
      'feedback', 'command outcome', '--include-logs=' + (failsDecoding ? 'false' : 'auto'), ...options,
    ], { HOME: home });
    assert.equal(feedback.code, 0, feedback.stderr);
    assert.equal(report.debug.included, false);
    assert.deepEqual(report.debug.files, []);
    assert.equal(report.reported_request_id, failsDecoding ? receipt : undefined);
    assert.equal(report.diagnostics, undefined);
  });
}
