#!/usr/bin/env node
// TORIMA の PWA 構成チェック。
// manifest・アイコン・sw.js の CORE_ASSETS / CACHE_NAME・index.html の参照を突き合わせ、
// インストールやオフライン動作を壊す食い違いを洗い出す。
//
// 使い方: node check-pwa.mjs [リポジトリのルート]
// 終了コード: エラーがあれば 1、警告のみ・問題なしなら 0。

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] || process.env.CLAUDE_PROJECT_DIR || process.cwd());

const errors = [];
const warnings = [];
const notes = [];

const err = m => errors.push(m);
const warn = m => warnings.push(m);
const note = m => notes.push(m);

const path = name => join(root, name);
const has = name => existsSync(path(name));
const read = name => readFileSync(path(name), 'utf8');

// PNG の IHDR チャンクから実寸を読む。先頭 8 バイトがシグネチャ、
// 続く長さ 4 + 型 4 の後ろに幅 4・高さ 4 がビッグエンディアンで並ぶ。
function pngSize(file) {
  const buf = readFileSync(file);
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function git(args) {
  try {
    return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

// ─── 前提: TORIMA のリポジトリか ───────────────────────
if (!has('index.html')) {
  console.error(`index.html が見つかりません: ${root}`);
  console.error('リポジトリのルートで実行するか、ルートを引数で渡してください。');
  process.exit(1);
}

const indexHtml = read('index.html');

// ─── manifest ─────────────────────────────────────────
let manifest = null;
if (!has('manifest.webmanifest')) {
  err('manifest.webmanifest がありません。PWA としてインストールできません。');
} else {
  try {
    manifest = JSON.parse(read('manifest.webmanifest'));
  } catch (e) {
    err(`manifest.webmanifest を JSON として読めません: ${e.message}`);
  }
}

if (manifest) {
  for (const field of ['name', 'start_url', 'display', 'icons']) {
    if (!manifest[field]) err(`manifest に ${field} がありません。`);
  }
  if (manifest.display && manifest.display !== 'standalone') {
    warn(`manifest の display が "${manifest.display}" です。ホーム画面から単体アプリとして開くには "standalone" が必要です。`);
  }

  const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
  const purposes = new Set();

  for (const icon of icons) {
    const src = String(icon.src || '').replace(/^\.\//, '');
    String(icon.purpose || 'any').split(/\s+/).filter(Boolean).forEach(p => purposes.add(p));

    if (!src) {
      err('manifest のアイコンに src がありません。');
      continue;
    }
    if (!has(src)) {
      err(`manifest が参照するアイコンがありません: ${src}`);
      continue;
    }

    const size = pngSize(path(src));
    if (!size) {
      warn(`${src} を PNG として読めませんでした。寸法を検証できません。`);
      continue;
    }
    const declared = String(icon.sizes || '');
    const match = /^(\d+)x(\d+)$/.exec(declared);
    if (!match) {
      warn(`${src} の sizes が "${declared}" です。"192x192" の形で書いてください。`);
    } else if (Number(match[1]) !== size.width || Number(match[2]) !== size.height) {
      err(`${src} の寸法が食い違っています: 宣言 ${declared}、実寸 ${size.width}x${size.height}。iOS はこの不一致でインストールを黙って拒みます。`);
    }
  }

  if (icons.length && !purposes.has('any')) warn('manifest に purpose "any" のアイコンがありません。');
  if (icons.length && !purposes.has('maskable')) warn('manifest に purpose "maskable" のアイコンがありません。Android で白い四角が出ることがあります。');

  const sizeSet = new Set(icons.map(i => String(i.sizes || '')));
  if (!sizeSet.has('192x192')) warn('192x192 のアイコンがありません。');
  if (!sizeSet.has('512x512')) warn('512x512 のアイコンがありません。');
}

// ─── index.html からの参照 ─────────────────────────────
if (!/<link[^>]+rel=["']manifest["']/.test(indexHtml)) {
  err('index.html に manifest への <link rel="manifest"> がありません。');
}

const appleIcon = /<link[^>]+rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/.exec(indexHtml);
if (!appleIcon) {
  warn('index.html に apple-touch-icon がありません。iOS のホーム画面アイコンが既定のものになります。');
} else {
  const src = appleIcon[1].replace(/^\.\//, '');
  if (!has(src)) err(`apple-touch-icon が参照するファイルがありません: ${src}`);
}

for (const meta of ['apple-mobile-web-app-capable', 'apple-mobile-web-app-status-bar-style', 'viewport']) {
  if (!indexHtml.includes(`name="${meta}"`)) {
    warn(`index.html の <meta name="${meta}"> が見当たりません。iOS での表示が崩れることがあります。`);
  }
}

// ─── sw.js ────────────────────────────────────────────
let cacheName = null;
if (!has('sw.js')) {
  err('sw.js がありません。PWA 化と端末通知が動きません。');
} else {
  const sw = read('sw.js');

  const cacheMatch = /const\s+CACHE_NAME\s*=\s*['"]([^'"]+)['"]/.exec(sw);
  if (!cacheMatch) {
    err('sw.js に CACHE_NAME が見つかりません。古いキャッシュを掃除できなくなります。');
  } else {
    cacheName = cacheMatch[1];
    note(`CACHE_NAME: ${cacheName}`);
  }

  const assetsMatch = /const\s+CORE_ASSETS\s*=\s*\[([^\]]*)\]/.exec(sw);
  if (!assetsMatch) {
    warn('sw.js に CORE_ASSETS が見つかりません。オフライン用のキャッシュが作られない可能性があります。');
  } else {
    const assets = [...assetsMatch[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
    if (!assets.length) warn('CORE_ASSETS が空です。');

    for (const asset of assets) {
      // './' はディレクトリのインデックス、つまり index.html を指す。
      const rel = asset.replace(/^\.\//, '') || 'index.html';
      if (!has(rel)) {
        err(`CORE_ASSETS が存在しないパスを含んでいます: ${asset} — cache.addAll() は 1 つでも欠けると全体が失敗し、オフライン用キャッシュが丸ごと作られません。`);
      }
    }

    if (!assets.some(a => a.replace(/^\.\//, '') === '' || a.includes('index.html'))) {
      warn('CORE_ASSETS に index.html（または "./"）が含まれていません。オフライン時のフォールバック先が無くなります。');
    }
  }

  if (!/registration\.showNotification|self\.registration\.showNotification|showNotification/.test(sw)) {
    warn('sw.js に showNotification の呼び出しがありません。Android Chrome では通知を出せません。');
  }
}

// ─── CACHE_NAME の上げ忘れ ─────────────────────────────
if (cacheName && git(['rev-parse', '--git-dir'])) {
  const changed = (git(['diff', '--name-only', 'HEAD', '--']) || '')
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  const appChanged = changed.some(f => ['index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'].includes(f));

  if (appChanged) {
    const headSw = git(['show', 'HEAD:sw.js']);
    const headCache = headSw && /const\s+CACHE_NAME\s*=\s*['"]([^'"]+)['"]/.exec(headSw);
    if (headCache && headCache[1] === cacheName) {
      warn(`${changed.filter(f => f !== 'sw.js').join(', ')} を変更していますが CACHE_NAME が "${cacheName}" のままです。リリース前に上げてください（上げないと利用者に古い画面が残り続けます）。`);
    } else if (headCache) {
      note(`CACHE_NAME は "${headCache[1]}" から "${cacheName}" へ更新済みです。`);
    }
  }
}

// ─── 出力 ─────────────────────────────────────────────
for (const n of notes) console.log(`  ${n}`);
if (notes.length && (warnings.length || errors.length)) console.log('');

for (const w of warnings) console.log(`警告: ${w}`);
for (const e of errors) console.log(`エラー: ${e}`);

console.log('');
if (errors.length) {
  console.log(`エラー ${errors.length} 件、警告 ${warnings.length} 件。`);
  process.exit(1);
}
if (warnings.length) {
  console.log(`エラーなし、警告 ${warnings.length} 件。`);
} else {
  console.log('PWA 構成に問題は見つかりませんでした。');
}
