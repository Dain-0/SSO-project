// ─────────────────────────────────────────────────────────────
// AES-256-GCM 암호화 모듈 (서비스 A, B가 함께 사용)
//  - 마스터 키(.env)에서 사용자별 키를 HKDF로 파생 → 사용자마다 다른 키 사용
//  - GCM은 암호화 + 변조 탐지(인증 태그)를 동시에 제공
//  - AAD(추가 인증 데이터)에 사용자 id를 넣어 "다른 사람의 메모로 바꿔치기"도 탐지
// ─────────────────────────────────────────────────────────────
import crypto from 'node:crypto';

// 마스터 키는 호출 시점에 읽는다 (dotenv가 먼저 로드되도록)
function masterKey() {
  const hex = process.env.MEMO_MASTER_KEY || '';
  if (hex.length !== 64) throw new Error('MEMO_MASTER_KEY는 64자리 hex(32바이트)여야 합니다');
  return Buffer.from(hex, 'hex');
}

// 사용자(sub)별 32바이트 키 파생
function userKey(sub) {
  return Buffer.from(
    crypto.hkdfSync('sha256', masterKey(), 'sso-memo-salt', `memo-key:${sub}`, 32)
  );
}

// 평문 → { iv, tag, ct } (모두 base64)
export function encrypt(sub, plaintext) {
  const iv = crypto.randomBytes(12); // GCM 권장 IV 길이 12바이트, 매번 새로 생성
  const cipher = crypto.createCipheriv('aes-256-gcm', userKey(sub), iv);
  cipher.setAAD(Buffer.from(sub));
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
    ct: ct.toString('base64'),
  };
}

// { iv, tag, ct } → 평문. 변조되었거나 키/사용자가 다르면 예외 발생
export function decrypt(sub, rec) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm', userKey(sub), Buffer.from(rec.iv, 'base64')
  );
  decipher.setAAD(Buffer.from(sub));
  decipher.setAuthTag(Buffer.from(rec.tag, 'base64'));
  const pt = Buffer.concat([
    decipher.update(Buffer.from(rec.ct, 'base64')),
    decipher.final(), // 인증 태그가 맞지 않으면 여기서 에러
  ]);
  return pt.toString('utf8');
}
