// 서비스 A: 메모 작성 → AES-256-GCM으로 암호화해서 저장 (암호문만 보여준다)
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import express from 'express';
import session from 'express-session';
import { createAuth } from '../common/auth.js';
import { encrypt } from '../common/crypto.js';
import { add, loadAll } from '../common/store.js';
import { page, esc } from '../common/ui.js';

dotenv.config({
    path: [
        fileURLToPath(new URL('./.env', import.meta.url)),
    ],
});
const PORT = 9000;
const ACCENT = '#0b7285'; 
const OTHER = { label: '서비스 B 열기', url: 'http://localhost:9001/' };

const app = express();
app.use(express.urlencoded({ extended: false }));
// 쿠키 이름을 서비스마다 다름 
app.use(session({ name: 'sid-a', secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false }));

const { router, requireLogin } = createAuth({
  port: PORT, clientId: 'service-a', clientSecret: process.env.CLIENT_A_SECRET,
});
app.use(router);

const render = (req, title, body) =>
  page({ title, accent: ACCENT, service: '서비스 A · 메모 작성', other: OTHER, user: req.session.user, body });


app.get('/', (req, res) => {
  if (req.session.user) return res.redirect('/memos');
  res.send(render(req, '서비스 A', `
    <h1>암호화 메모 작성</h1>
    <p class="sub">쓴 메모는 AES-256-GCM으로 암호화되어 저장됩니다. 로그인이 필요합니다.</p>
    <a class="btn" href="/login">Keycloak으로 로그인</a>`));
});

// 메모 작성 + 내 메모의 암호문 목록 (보호된 페이지)
app.get('/memos', requireLogin, (req, res) => {
  const mine = loadAll().filter((m) => m.owner === req.session.user.sub).reverse();
  const list = mine.length
    ? mine.map((m) => `
      <div class="box">
        <div class="meta">${esc(m.createdAt)}</div>
        <details open><summary>저장된 암호문</summary>
          <div class="cipher">${esc(m.ct.slice(0, 120))}${m.ct.length > 120 ? '…' : ''}</div>
        </details>
      </div>`).join('')
    : '<div class="empty">아직 저장된 메모가 없습니다. 위에서 첫 메모를 작성하세요.</div>';

  res.send(render(req, '서비스 A · 메모', `
    <h1>새 메모</h1>
    <p class="sub">저장하면 암호화됩니다. 읽으려면 <a href="${OTHER.url}">서비스 B</a>에서 열어 보세요.</p>
    <form class="box" method="post" action="/memos">
      <textarea name="text" maxlength="2000" required placeholder="비밀 메모를 입력하세요"></textarea>
      <p><button type="submit">암호화해서 저장</button></p>
    </form>
    <h1>내 메모 (암호문)</h1>
    ${list}`));
});

// 메모 저장: 평문 → 암호화 → 파일 저장
app.post('/memos', requireLogin, (req, res) => {
  const text = String(req.body.text || '').trim().slice(0, 2000);
  if (text) {
    const { sub, name } = req.session.user;
    add({ id: crypto.randomUUID(), owner: sub, ownerName: name, createdAt: new Date().toLocaleString('ko-KR'), ...encrypt(sub, text) });
  }
  res.redirect('/memos');
});

app.use((err, req, res, next) => res.status(500).send(`오류: ${esc(err.message)}`));
app.listen(PORT, () => console.log(`서비스 A: http://localhost:${PORT}`));
