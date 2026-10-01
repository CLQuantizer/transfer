#!/usr/bin/env node
/**
 * transfer CLI — upload / list / download against transfer.gongxifacai.win
 * Auth: Cloudflare Access (service token or cloudflared)
 */
import { spawnSync } from 'node:child_process';
import { createWriteStream, mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

const DEFAULT_BASE_URL = 'https://transfer.gongxifacai.win';
const CONFIG_DIR = join(homedir(), '.config', 'transfer');
const CONFIG_PATH = join(CONFIG_DIR, 'config.json');

function usage() {
	console.log(`transfer — CLI for ${DEFAULT_BASE_URL}

Usage:
  transfer login                         Save Access credentials (interactive)
  transfer login --cloudflared           Prefer cloudflared browser login
  transfer logout                        Clear saved credentials
  transfer list                          List uploaded files
  transfer upload <file> [--expires N]   Upload a file (optional expiry in hours)
  transfer download <key|shortKey> [-o path]
  transfer delete <key>                  Delete a file
  transfer help

Auth (first match wins):
  1. CF_ACCESS_CLIENT_ID + CF_ACCESS_CLIENT_SECRET env vars
  2. Saved service token from \`transfer login\`
  3. cloudflared access token (after \`cloudflared access login\`)

Config: ${CONFIG_PATH}
`);
}

function loadConfig() {
	if (!existsSync(CONFIG_PATH)) {
		return { baseUrl: DEFAULT_BASE_URL };
	}
	try {
		return { baseUrl: DEFAULT_BASE_URL, ...JSON.parse(readFileSync(CONFIG_PATH, 'utf8')) };
	} catch {
		return { baseUrl: DEFAULT_BASE_URL };
	}
}

function saveConfig(config) {
	mkdirSync(CONFIG_DIR, { recursive: true });
	writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n', { mode: 0o600 });
}

function formatSize(bytes) {
	if (!bytes) return '0 B';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const i = Math.floor(Math.log(bytes) / Math.log(1024));
	return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function prompt(question, { secret = false } = {}) {
	if (secret && input.isTTY) {
		// Hide input for secrets when possible
		output.write(question);
		input.setRawMode?.(true);
		let value = '';
		return await new Promise((resolvePromise) => {
			const onData = (char) => {
				const s = char.toString();
				if (s === '\n' || s === '\r' || s === '\u0004') {
					input.setRawMode?.(false);
					input.off('data', onData);
					output.write('\n');
					resolvePromise(value);
				} else if (s === '\u0003') {
					process.exit(1);
				} else if (s === '\u007f' || s === '\b') {
					value = value.slice(0, -1);
				} else {
					value += s;
				}
			};
			input.on('data', onData);
		});
	}
	const rl = createInterface({ input, output });
	const answer = await rl.question(question);
	rl.close();
	return answer.trim();
}

async function getAuthHeaders(config) {
	const envId = process.env.CF_ACCESS_CLIENT_ID;
	const envSecret = process.env.CF_ACCESS_CLIENT_SECRET;
	if (envId && envSecret) {
		return {
			'CF-Access-Client-Id': envId,
			'CF-Access-Client-Secret': envSecret
		};
	}

	if (config.clientId && config.clientSecret) {
		return {
			'CF-Access-Client-Id': config.clientId,
			'CF-Access-Client-Secret': config.clientSecret
		};
	}

	// Prefer cloudflared JWT
	const tokenResult = spawnSync(
		'cloudflared',
		['access', 'token', `-app=${config.baseUrl}`],
		{ encoding: 'utf8' }
	);
	if (tokenResult.status === 0) {
		const token = tokenResult.stdout.trim();
		if (token && !token.toLowerCase().includes('error')) {
			return { 'CF-Access-Token': token };
		}
	}

	throw new Error(
		`Not authenticated.\nRun: transfer login\nOr: cloudflared access login ${config.baseUrl}\nOr set CF_ACCESS_CLIENT_ID / CF_ACCESS_CLIENT_SECRET`
	);
}

async function api(config, path, { method = 'GET', headers = {}, body, raw = false } = {}) {
	const auth = await getAuthHeaders(config);
	const res = await fetch(`${config.baseUrl}${path}`, {
		method,
		headers: { ...auth, ...headers },
		body
	});

	if (raw) return res;

	const text = await res.text();
	let data = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = { message: text };
	}

	if (!res.ok) {
		const msg = data?.message || data?.error || res.statusText || `HTTP ${res.status}`;
		throw new Error(`${msg} (${res.status})`);
	}
	return data;
}

async function cmdLogin(args) {
	const config = loadConfig();
	const useCloudflared = args.includes('--cloudflared');

	if (useCloudflared) {
		console.log(`Opening Cloudflare Access login for ${config.baseUrl}...`);
		const result = spawnSync('cloudflared', ['access', 'login', config.baseUrl], {
			stdio: 'inherit'
		});
		if (result.status !== 0) {
			throw new Error('cloudflared access login failed. Is cloudflared installed?');
		}
		config.authMode = 'cloudflared';
		delete config.clientId;
		delete config.clientSecret;
		saveConfig(config);
		console.log('Logged in via cloudflared. Token is cached by cloudflared on this device.');
		return;
	}

	console.log('Paste your Cloudflare Access Service Token credentials.');
	console.log('(Zero Trust → Access → Service Auth → Create Service Token)\n');
	const clientId = await prompt('Client ID: ');
	const clientSecret = await prompt('Client Secret: ', { secret: true });
	if (!clientId || !clientSecret) {
		throw new Error('Both Client ID and Client Secret are required');
	}

	config.authMode = 'service-token';
	config.clientId = clientId;
	config.clientSecret = clientSecret;
	saveConfig(config);
	console.log(`Saved credentials to ${CONFIG_PATH}`);
}

async function cmdLogout() {
	if (existsSync(CONFIG_PATH)) {
		const config = loadConfig();
		saveConfig({ baseUrl: config.baseUrl || DEFAULT_BASE_URL });
		console.log('Cleared saved credentials.');
	} else {
		console.log('Nothing to clear.');
	}
}

async function cmdList() {
	const config = loadConfig();
	const data = await api(config, '/private/files');
	const files = data.files || [];

	if (files.length === 0) {
		console.log('No files.');
		return;
	}

	console.log(
		`${'FILENAME'.padEnd(32)} ${'SIZE'.padStart(10)}  ${'UPLOADED'.padEnd(20)}  KEY / SHORT`
	);
	console.log('-'.repeat(90));
	for (const f of files) {
		const name = (f.filename || '').slice(0, 32).padEnd(32);
		const size = formatSize(f.size).padStart(10);
		const uploaded = new Date(f.uploadedAt).toISOString().replace('T', ' ').slice(0, 19);
		const id = f.shortKey ? `${f.shortKey}  (${f.key})` : f.key;
		console.log(`${name} ${size}  ${uploaded}  ${id}`);
	}
	console.log(`\n${files.length} file(s)`);
}

async function cmdUpload(args) {
	const expiresIdx = args.indexOf('--expires');
	let expiresInHours;
	if (expiresIdx !== -1) {
		expiresInHours = parseInt(args[expiresIdx + 1], 10);
		if (Number.isNaN(expiresInHours)) {
			throw new Error('--expires requires a number of hours');
		}
		args = args.filter((_, i) => i !== expiresIdx && i !== expiresIdx + 1);
	}

	const filePath = args[0];
	if (!filePath) throw new Error('Usage: transfer upload <file> [--expires N]');

	const abs = resolve(filePath);
	if (!existsSync(abs)) throw new Error(`File not found: ${abs}`);

	const config = loadConfig();
	const buf = readFileSync(abs);
	const name = basename(abs);
	const form = new FormData();
	form.append('file', new Blob([buf]), name);
	if (expiresInHours != null) {
		form.append('expiresInHours', String(expiresInHours));
	}

	process.stderr.write(`Uploading ${name} (${formatSize(buf.length)})...\n`);
	const data = await api(config, '/private/upload', { method: 'POST', body: form });

	console.log(`Uploaded: ${data.filename}`);
	console.log(`Key:      ${data.key}`);
	if (data.shortKey) {
		console.log(`Short:    ${data.shortKey}`);
		console.log(`URL:      ${config.baseUrl}/private/download/${data.shortKey}`);
	}
	if (data.expiresAt) console.log(`Expires:  ${data.expiresAt}`);
}

async function cmdDownload(args) {
	let outPath;
	const oIdx = args.indexOf('-o');
	if (oIdx !== -1) {
		outPath = args[oIdx + 1];
		if (!outPath) throw new Error('-o requires a path');
		args = args.filter((_, i) => i !== oIdx && i !== oIdx + 1);
	}

	const key = args[0];
	if (!key) throw new Error('Usage: transfer download <key|shortKey> [-o path]');

	const config = loadConfig();
	process.stderr.write(
		'Note: download is one-time — the file is deleted from the server after download.\n'
	);

	const res = await api(config, `/private/download/${encodeURIComponent(key)}`, { raw: true });
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Download failed: ${res.status} ${text}`);
	}

	const disposition = res.headers.get('content-disposition') || '';
	const match = disposition.match(/filename="?([^";]+)"?/i);
	const filename = outPath || match?.[1] || key;

	const body = Readable.fromWeb(res.body);
	await pipeline(body, createWriteStream(filename));
	console.log(`Saved: ${filename} (${formatSize(Number(res.headers.get('content-length') || 0))})`);
}

async function cmdDelete(args) {
	const key = args[0];
	if (!key) throw new Error('Usage: transfer delete <key>');
	const config = loadConfig();
	await api(config, `/private/delete/${encodeURIComponent(key)}`, { method: 'DELETE' });
	console.log(`Deleted: ${key}`);
}

async function main() {
	const [, , cmd, ...args] = process.argv;

	try {
		switch (cmd) {
			case 'login':
				await cmdLogin(args);
				break;
			case 'logout':
				await cmdLogout();
				break;
			case 'list':
			case 'ls':
				await cmdList();
				break;
			case 'upload':
			case 'up':
				await cmdUpload(args);
				break;
			case 'download':
			case 'dl':
			case 'get':
				await cmdDownload(args);
				break;
			case 'delete':
			case 'rm':
				await cmdDelete(args);
				break;
			case 'help':
			case '--help':
			case '-h':
			case undefined:
				usage();
				break;
			default:
				console.error(`Unknown command: ${cmd}\n`);
				usage();
				process.exit(1);
		}
	} catch (err) {
		console.error(`Error: ${err.message || err}`);
		process.exit(1);
	}
}

main();
