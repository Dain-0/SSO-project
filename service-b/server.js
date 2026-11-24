// 서비스 B: SSO로 로그인한 사용자의 메모를 복호화해서 보여준다
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import express from 'express';
import session from 'express-session';
import { createAuth } from '../common/auth.js';
import { decrypt } from '../common/crypto.js';
import { loadAll } from '../common/store.js';
import { page, esc } from '../common/ui.js';

dotenv.config({
    path: [
        fileURLToPath(new URL('./.env', import.meta.url)),
    ],
});

const PORT = 9001;
const ACCENT = '#4c4fa3';
const OTHER = { label: '서비스 A 열기', url: 'http://localhost:9000/' };

const app = express();
app.use(session({ name: 'sid-b', secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));

const { router, requireLogin } = createAuth({
  port: PORT, clientId: 'service-b', clientSecret: process.env.CLIENT_B_SECRET,
});
app.use(router);


const render = (req, title, body) =>
  page({ title, accent: ACCENT, service: '서비스 B · 메모 열람', other: OTHER, user: req.session.user, body });

app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/memos');
  res.send(render(req, '서비스 B', `
    <h1>암호화 메모 열람</h1>
    <p class="sub">서비스 A에서 저장한 메모를 복호화해서 읽습니다. 로그인이 필요합니다.</p>
    <a class="btn" href="/login">Keycloak으로 로그인</a>`));
});

app.get('/memos', requireLogin, (req, res) => {
  const { sub, name, email } = req.session.user;
  const mine = loadAll().filter((m) => m.owner === sub).reverse();

  const list = mine.length
    ? mine.map((m) => {
        let plain;
        try { plain = esc(decrypt(sub, m)); }               // 복호화 (인증 태그 검증 포함)
        catch { plain = '<i>복호화 실패: 데이터가 변조되었습니다</i>'; }
        return `
        <div class="box">
          <div class="meta">${esc(m.createdAt)}</div>
          <div class="plain">${plain}</div>
          <details><summary>암호문 보기</summary>
            <div class="cipher">iv: ${esc(m.iv)}<br>tag: ${esc(m.tag)}<br>ct: ${esc(m.ct)}</div>
          </details>
        </div>`;
      }).join('')
    : '<div class="empty">읽을 메모가 없습니다. 서비스 A에서 메모를 먼저 작성하세요.</div>';

  res.send(render(req, '서비스 B · 메모', `
    <h1>내 메모 (복호화됨)</h1>
    <p class="sub">${esc(name)}${email ? ` (${esc(email)})` : ''} 계정으로 SSO 로그인됨</p>
    ${list}`));
});

app.use((err, req, res, next) => res.status(500).send(`오류: ${esc(err.message)}`));
app.listen(PORT, () => console.log(`서비스 B: http://localhost:${PORT}`));
