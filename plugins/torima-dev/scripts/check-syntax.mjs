#!/usr/bin/env node
// index.html に埋め込まれた <script> ブロックの構文チェック。
//
// TORIMA はビルドもテストも無く、JS のどこか 1 箇所が構文エラーになれば画面全体が死ぬ。
// コンパイルだけ行って（実行はしない）、エラー行を index.html の行番号で報告する。
//
// 使い方: node check-syntax.mjs [index.html のパス]

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const file = resolve(process.argv[2] || `${root}/index.html`);

let html;
try {
  html = readFileSync(file, 'utf8');
} catch (e) {
  console.error(`読み込めません: ${file}`);
  process.exit(1);
}

// src 属性の無い <script> ブロックだけを対象にする（CDN の SDK 読み込みは除く）。
const blocks = [...html.matchAll(/<script>\n([\s\S]*?)\n<\/script>/g)];

if (!blocks.length) {
  console.error('src の無い <script> ブロックが見つかりませんでした。');
  process.exit(1);
}

let failed = false;

for (const block of blocks) {
  const code = block[1];
  // ブロック開始位置までの改行数 + 1 が、コード 1 行目の index.html 上の行番号。
  const startLine = html.slice(0, block.index).split('\n').length;

  try {
    new vm.Script(code, { filename: file, lineOffset: startLine });
    console.log(`構文 OK: ${startLine + 1} 行目から ${code.split('\n').length} 行`);
  } catch (e) {
    failed = true;
    console.log(`構文エラー: ${e.message}`);
    if (e.stack) {
      const location = e.stack.split('\n').slice(0, 3).join('\n');
      console.log(location);
    }
  }
}

process.exit(failed ? 1 : 0);
