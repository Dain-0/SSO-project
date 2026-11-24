// 암호화된 메모를 JSON 파일에 저장 (A, B가 같은 파일을 공유)
// 파일을 열어 보면 내용이 전부 암호문(base64)으로 보인다 → 캡처용
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'memos.json');

export function loadAll() {
  try { return JSON.parse(fs.readFileSync(FILE, 'utf8')); } catch { return []; }
}

export function add(record) {
  const all = loadAll();
  all.push(record);
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(all, null, 2));
}

export const STORE_PATH = FILE;
