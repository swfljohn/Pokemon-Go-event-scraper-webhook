// Shared look for the public pages: dark background, purple accents, white text, yellow for key info.
export const PAGE_STYLE = `
:root{--bg:#0d0a14;--panel:#171124;--line:#2d2342;--text:#f4f1fa;--muted:#a99cc2;--accent:#9b5cff;--key:#ffd54a;--bad:#ff6b6b;--ok:#4ade80}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--text);font:15px/1.5 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
a{color:#c7a6ff}code{background:#22183a;padding:1px 5px;border-radius:4px;font-size:13px}
.bar{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--line);background:#120d1d}
.brand{font-weight:800;color:var(--text);text-decoration:none;letter-spacing:.3px}.bar nav a{margin-left:16px;color:var(--muted);text-decoration:none}
main{max-width:920px;margin:0 auto;padding:24px 18px 60px}h1{margin:.2em 0 .3em;font-size:28px}
.muted{color:var(--muted)}.section{margin-top:28px;font-size:18px}.section span{color:var(--key)}
.card{display:flex;gap:16px;background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px;margin:12px 0}
.card.selected{border-color:var(--key);box-shadow:0 0 0 2px #ffd54a33}.card img{width:120px;height:68px;object-fit:cover;border-radius:8px;flex:none}
.card h2{margin:0 0 4px;font-size:17px}.card h2 a{color:var(--text);text-decoration:none}.meta{margin:0;color:var(--key);font-size:13px}
.card ul{margin:6px 0;padding-left:18px;color:var(--muted)}.source{font-size:12px;color:var(--muted);margin:4px 0 0}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:18px;margin:16px 0}
label{display:block;margin:10px 0 4px;color:var(--muted);font-size:13px}
input[type=text],input[type=url],input[type=time],select,textarea{width:100%;background:#0f0b18;color:var(--text);border:1px solid var(--line);border-radius:8px;padding:9px 10px;font:inherit}
.row{display:flex;gap:12px;flex-wrap:wrap}.row>*{flex:1 1 200px}
.check{display:flex;gap:8px;align-items:flex-start;margin:6px 0;color:var(--text)}.check input{margin-top:4px}
button,.button{background:var(--accent);color:#fff;border:0;border-radius:9px;padding:9px 14px;font:inherit;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block}
button.ghost{background:transparent;border:1px solid var(--line);color:var(--text)}button.danger{background:#5a1d2b}
button:disabled{opacity:.5;cursor:default}.actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
.status{padding:10px 12px;border-radius:9px;margin:12px 0;background:#22183a}.status.error{background:#3a1820;color:#ffc4c4}.status.ok{background:#14301f;color:#c9f7d6}
table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:7px 6px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--muted);font-weight:600}
.pill{display:inline-block;padding:1px 8px;border-radius:99px;font-size:12px;background:#22183a}.pill.ok{color:var(--ok)}.pill.bad{color:var(--bad)}.pill.warn{color:var(--key)}
iframe{width:100%;height:900px;border:1px solid var(--line);border-radius:12px;background:#000}
@media(max-width:600px){.card{flex-direction:column}.card img{width:100%;height:auto}}
`;
