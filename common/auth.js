// ─────────────────────────────────────────────────────────────
// Keycloak OIDC 로그인 (Authorization Code Flow) — 라이브러리 없이 직접 구현
//   /login    : Keycloak 로그인 화면으로 이동
//   /callback : code를 토큰으로 교환 → ID 토큰 서명 검증(JWKS) → 세션 생성
//   /logout   : 로컬 세션 삭제 + Keycloak SSO 세션 종료
//   requireLogin : 보호된 페이지용. Keycloak 세션이 살아있는지 매번 확인
// ─────────────────────────────────────────────────────────────
import crypto from 'node:crypto';
import { Router } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';

let meta;  // Keycloak의 OIDC 설정 (엔드포인트 주소들)
let jwks;  // Keycloak 공개키 (토큰 서명 검증용)

async function discover() {
  if (!meta) {
    const res = await fetch(`${process.env.KC_ISSUER}/.well-known/openid-configuration`);
    if (!res.ok) throw new Error('Keycloak에 연결할 수 없습니다. 실행 중인지 확인하세요.');
    meta = await res.json();
    jwks = createRemoteJWKSet(new URL(meta.jwks_uri));
  }
  return meta;
}

export function createAuth({ port, clientId, clientSecret }) {
  const base = `http://localhost:${port}`;
  const router = Router();

  // 1) 로그인 시작: Keycloak 인증 화면으로 보낸다
  router.get('/login', async (req, res, next) => {
    try {
      const m = await discover();
      const state = crypto.randomBytes(16).toString('hex'); // CSRF 방지용 난수
      req.session.oauthState = state;
      const url = new URL(m.authorization_endpoint);
      url.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${base}/callback`,
        response_type: 'code',
        scope: 'openid profile email',
        state,
      }).toString();
      req.session.save(() => res.redirect(url.toString()));
    } catch (e) { next(e); }
  });

  // 2) 로그인 완료 후 돌아오는 곳: code → 토큰 교환
  router.get('/callback', async (req, res, next) => {
    try {
      const { code, state } = req.query;
      if (!code || state !== req.session.oauthState) {
        return res.status(400).send('잘못된 로그인 요청입니다 (state 불일치)');
      }
      const m = await discover();
      const tokenRes = await fetch(m.token_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: `${base}/callback`,
          client_id: clientId,
          client_secret: clientSecret,
        }),
      });
      const tokens = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokens.error_description || '토큰 발급 실패');

      // ID 토큰의 서명·발급자·대상(audience)을 Keycloak 공개키로 검증 (암호학: RS256 전자서명)
      const { payload } = await jwtVerify(tokens.id_token, jwks, {
        issuer: m.issuer,
        audience: clientId,
      });

      req.session.user = {
        sub: payload.sub,
        name: payload.preferred_username || payload.sub,
        email: payload.email,
      };
      req.session.idToken = tokens.id_token;
      req.session.accessToken = tokens.access_token;
      delete req.session.oauthState;
      req.session.save(() => res.redirect('/memos'));
    } catch (e) { next(e); }
  });

  // 3) 로그아웃: 이 서비스의 세션 삭제 + Keycloak 세션 종료
  router.get('/logout', async (req, res, next) => {
    try {
      const m = await discover();
      const idToken = req.session.idToken;
      const url = new URL(m.end_session_endpoint);
      url.search = new URLSearchParams({
        post_logout_redirect_uri: `${base}/`,
        ...(idToken ? { id_token_hint: idToken } : { client_id: clientId }),
      }).toString();
      req.session.destroy(() => res.redirect(url.toString()));
    } catch (e) { next(e); }
  });

  // 보호된 페이지 미들웨어: 로그인 안 했거나 Keycloak 세션이 끝났으면 /login으로
  // → 다른 서비스에서 로그아웃하면 여기서도 바로 로그아웃 상태가 된다
  async function requireLogin(req, res, next) {
    try {
      if (!req.session.user) return res.redirect('/login');
      const m = await discover();
      const r = await fetch(m.userinfo_endpoint, {
        headers: { Authorization: `Bearer ${req.session.accessToken}` },
      });
      if (!r.ok) return req.session.destroy(() => res.redirect('/login'));
      next();
    } catch (e) { next(e); }
  }

  return { router, requireLogin };
}
