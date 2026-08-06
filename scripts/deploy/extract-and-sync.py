#!/usr/bin/env python3
"""Extract Windows-made tarball with sane modes, rsync into /var/www/arthawks."""
from __future__ import annotations

import os
import shutil
import subprocess
import tarfile
from pathlib import Path

HOME = Path.home()
ARCHIVE = HOME / "arthawks-deploy.tgz"
EXTRACT = HOME / "arthawks-extract"
APP = Path("/var/www/arthawks")


def extract() -> None:
	if EXTRACT.exists():
		# Force writable before delete (Windows tar can leave 0555 dirs)
		for root, dirs, files in os.walk(EXTRACT):
			for d in dirs:
				try:
					os.chmod(Path(root) / d, 0o755)
				except OSError:
					pass
			for f in files:
				try:
					os.chmod(Path(root) / f, 0o644)
				except OSError:
					pass
		shutil.rmtree(EXTRACT)
	EXTRACT.mkdir(parents=True)

	with tarfile.open(ARCHIVE, "r:gz") as tf:
		for m in tf:
			name = m.name.lstrip("./")
			if not name or name.startswith("/") or ".." in Path(name).parts:
				continue
			target = EXTRACT / name
			if m.isdir():
				target.mkdir(parents=True, exist_ok=True)
				os.chmod(target, 0o755)
				continue
			if m.issym() or m.islnk():
				continue
			target.parent.mkdir(parents=True, exist_ok=True)
			src = tf.extractfile(m)
			if src is None:
				continue
			with open(target, "wb") as out:
				out.write(src.read())
			os.chmod(target, 0o644)

	assert (EXTRACT / "src/lib/server/email.ts").is_file(), "email.ts missing"
	assert (EXTRACT / "package.json").is_file(), "package.json missing"
	print("PY_EXTRACT_OK")


def sync() -> None:
	cmd = [
		"rsync",
		"-a",
		"--delete",
		"--exclude",
		".env",
		"--exclude",
		"node_modules",
		"--exclude",
		"build",
		"--exclude",
		".svelte-kit",
		"--exclude",
		".data",
		f"{EXTRACT}/",
		f"{APP}/",
	]
	subprocess.check_call(cmd)
	assert (APP / "src/lib/server/email.ts").is_file()
	assert (APP / ".env").is_file(), "server .env missing after sync"
	print("SYNC_OK")


def load_env() -> tuple[dict[str, str], list[str]]:
	env_path = APP / ".env"
	kv: dict[str, str] = {}
	order: list[str] = []
	if not env_path.is_file():
		return kv, order
	for ln in env_path.read_text().splitlines():
		s = ln.strip()
		if not s or s.startswith("#") or "=" not in ln:
			continue
		k, v = ln.split("=", 1)
		k = k.strip()
		if k not in kv:
			order.append(k)
		kv[k] = v
	return kv, order


def write_env(kv: dict[str, str], order: list[str]) -> None:
	env_path = APP / ".env"
	# Production runtime defaults
	for k, v in (
		("ORIGIN", "https://arthawks.com"),
		("HOST", "127.0.0.1"),
		("PORT", "3000"),
	):
		if k not in kv:
			order.append(k)
		kv[k] = v
	env_path.write_text("\n".join(f"{k}={kv[k]}" for k in order) + "\n")
	os.chmod(env_path, 0o640)


def merge_fragment(path: Path, allow_prefix: tuple[str, ...] | None = None) -> list[str]:
	if not path.is_file():
		return []
	kv, order = load_env()
	merged: list[str] = []
	for ln in path.read_text().splitlines():
		s = ln.strip()
		if not s or s.startswith("#") or "=" not in ln:
			continue
		k, v = ln.split("=", 1)
		k = k.strip()
		if allow_prefix and not any(k.startswith(p) for p in allow_prefix):
			continue
		if k not in kv:
			order.append(k)
		kv[k] = v
		merged.append(k)
	if merged:
		write_env(kv, order)
	return merged


def merge_env_fragments() -> None:
	mail = merge_fragment(HOME / "arthawks-mail.env", ("MAIL_",))
	print("MAIL_MERGED:" + (",".join(mail) if mail else "none"))
	captcha = merge_fragment(
		HOME / "arthawks-captcha.env",
		("PUBLIC_RECAPTCHA_", "RECAPTCHA_"),
	)
	print("CAPTCHA_MERGED:" + (",".join(captcha) if captcha else "none"))
	# Always normalize production host vars even if no fragments
	kv, order = load_env()
	write_env(kv, order)


if __name__ == "__main__":
	extract()
	sync()
	merge_env_fragments()
