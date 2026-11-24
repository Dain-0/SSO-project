// 공통 HTML 틀. 색상은 아래 :root 변수에서 바꾸면 된다.
export const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function page({ title, accent, service, other, user, body }) {
  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  :root { --bg:#f2f5f7; --ink:#18232d; --muted:#5d6b78; --line:#d5dde3; --card:#ffffff; --accent:${accent}; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
         font-family:"Pretendard","Malgun Gothic",system-ui,sans-serif; line-height:1.6; }
  header { background:var(--accent); color:#fff; padding:14px 24px;
           display:flex; align-items:center; justify-content:space-between; gap:16px; flex-wrap:wrap; }
  header b { font-size:1.15rem; }
  header a { color:#fff; margin-left:16px; }
  main { max-width:720px; margin:32px auto; padding:0 20px; }
  h1 { font-size:1.6rem; margin:0 0 8px; }
  p.sub { color:var(--muted); margin:0 0 24px; }
  .box { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:20px; margin-bottom:16px; }
  textarea { width:100%; min-height:110px; padding:10px; font:inherit; border:1px solid var(--line); border-radius:6px; }
  button, .btn { background:var(--accent); color:#fff; border:0; border-radius:6px; padding:10px 18px;
                 font:inherit; cursor:pointer; text-decoration:none; display:inline-block; }
  button:focus-visible, .btn:focus-visible, a:focus-visible, textarea:focus-visible { outline:3px solid #f2b705; outline-offset:2px; }
  .meta { color:var(--muted); font-size:.85rem; margin-bottom:6px; }
  .plain { font-size:1.05rem; white-space:pre-wrap; }
  code, .cipher { font-family:Consolas,monospace; font-size:.8rem; word-break:break-all; color:#8a2d3b; }
  details summary { cursor:pointer; color:var(--muted); font-size:.85rem; }
  .empty { color:var(--muted); text-align:center; padding:24px; }
</style></head>
<body>
<header>
  <b>${esc(service)}</b>
  <nav>
    ${user ? `${esc(user.name)} 님 <a href="/logout">로그아웃</a>` : ''}
    <a href="${esc(other.url)}">${esc(other.label)}</a>
  </nav>
</header>
<main>${body}</main>
</body></html>`;
}
