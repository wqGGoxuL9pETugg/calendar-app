#!/usr/bin/env node
// PostToolUse フック: index.html などアプリ本体を編集したのに sw.js の CACHE_NAME が
// 据え置きのままなら、その場で一度だけ知らせる。
//
// CACHE_NAME を上げ忘れると、activate 時に古いキャッシュが削除されず、
// ホーム画面に追加した利用者に古い画面が残り続ける。編集直後に気づけるのが一番安い。
//
// 静かに失敗する方針: 判断できない状況（TORIMA 以外のリポジトリ、git が無い等）では
// 何も出さず終了コード 0 で抜ける。フックが作業の邪魔をしてはいけない。

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

const WATCHED = ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
const CACHE_RE = /const\s+CACHE_NAME\s*=\s*['"]([^'"]+)['"]/;

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

function git(cwd, args) {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function emit(context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PostToolUse',
      additionalContext: context,
    },
  }));
}

try {
  const raw = readStdin();
  if (!raw.trim()) process.exit(0);

  const input = JSON.parse(raw);
  const filePath = input?.tool_input?.file_path;
  if (!filePath || !WATCHED.includes(basename(filePath))) process.exit(0);

  const projectDir = process.env.CLAUDE_PROJECT_DIR || input.cwd;
  if (!projectDir) process.exit(0);

  const swPath = join(projectDir, 'sw.js');
  if (!existsSync(swPath)) process.exit(0); // TORIMA のリポジトリではない

  const current = CACHE_RE.exec(readFileSync(swPath, 'utf8'));
  if (!current) process.exit(0);

  if (!git(projectDir, ['rev-parse', '--git-dir'])) process.exit(0);

  const headSw = git(projectDir, ['show', 'HEAD:sw.js']);
  const head = headSw && CACHE_RE.exec(headSw);
  if (!head) process.exit(0);          // 初回コミット前など、比較できない
  if (head[1] !== current[1]) process.exit(0); // すでに上げてある

  // 同じセッションで何度も言わない。編集のたびに繰り返すと雑音になる。
  const stateDir = process.env.CLAUDE_PLUGIN_DATA || join(tmpdir(), 'torima-dev');
  const marker = join(stateDir, `cache-reminder-${input.session_id || 'default'}`);
  if (existsSync(marker)) process.exit(0);

  mkdirSync(stateDir, { recursive: true });
  writeFileSync(marker, current[1]);

  emit(
    `${basename(filePath)} を変更しましたが、sw.js の CACHE_NAME は "${current[1]}" のままです。` +
    'リリース前に上げてください（上げないと、ホーム画面に追加した利用者に古い画面が残り続けます）。' +
    '手順は /torima-dev:release、構成の検証は /torima-dev:pwa-check にあります。'
  );
} catch {
  // 何も言わずに抜ける。フックの不具合で編集を妨げない。
}

process.exit(0);
