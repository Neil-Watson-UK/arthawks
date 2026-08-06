import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

function loadEnv(filePath) {
	if (!fs.existsSync(filePath)) return;
	for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
		const match = line.match(/^([^#=]+)=(.*)$/);
		if (!match) continue;
		let value = match[2].trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		process.env[match[1].trim()] ??= value;
	}
}

loadEnv('.env');
loadEnv('.env.local');

const dbUrl =
	process.env.DATABASE_URL ||
	process.env.DIRECT_URL ||
	process.env.SUPABASE_DB_URL ||
	process.env.POSTGRES_URL ||
	process.env.SUPABASE_DATABASE_URL;

if (!dbUrl) {
	console.error(
		'NO_DB_URL: Add DATABASE_URL (Supabase → Project Settings → Database → URI) to .env, then re-run.'
	);
	process.exit(2);
}

let pg;
try {
	pg = require('pg');
} catch {
	console.error('NO_PG: run npm install pg --no-save');
	process.exit(3);
}

const migrationsDir = path.resolve('supabase/migrations');
const files = fs
	.readdirSync(migrationsDir)
	.filter((name) => name.endsWith('.sql'))
	.sort();

const client = new pg.Client({
	connectionString: dbUrl,
	ssl: { rejectUnauthorized: false }
});

await client.connect();
console.log(`Connected. Applying ${files.length} migration files…`);

for (const file of files) {
	const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
	process.stdout.write(`→ ${file} `);
	try {
		await client.query(sql);
		console.log('OK');
	} catch (error) {
		console.log('FAIL');
		console.error(error.message);
		await client.end();
		process.exit(1);
	}
}

await client.end();
console.log('All migrations applied.');
