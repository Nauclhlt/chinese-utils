import json

with open('.cache/textbook_research.json', encoding='utf-8') as f:
    data = json.load(f)

lines = []
lines.append('# 参考教材 調査結果 (RESEARCH.md)\n')
lines.append('## 1. 教材概要・著作権・利用方針\n')
lines.append('- **教材名**: 中国語CALL教材 －上海・2026－（京都大学中国語部会編）')
lines.append('- **調査対象URL**: https://hanyujiaocai.jinkan.kyoto-u.ac.jp/2018shanghai/2018CALL/index.html')
lines.append('- **著作権表示**: `©京都大学中国語部会・京都大学学術情報メディアセンター` / `未经许可不得擅自转载本网站刊登的内容、录像、照片等。`')
lines.append('- **本アプリでの取り扱い**: 上記著作権表示を遵守し、教材の本文・例文・単語表・音声・画像の転載は一切行わない。本アプリは教材の学習範囲・文法シラバス・語彙トピック範囲・練習目標を調査した上で、**すべての解説・例文・単語説明・練習問題・作文問題を独自に作成**する。原典確認用に各課・各文法事項へ公式URLを掲載する。\n')

pages = data['pages']
ok_pages = [p for p in pages if p['status'] == 200]
fail_pages = [p for p in pages if p['status'] != 200]
lines.append('## 2. 調査サマリー\n')
lines.append(f'- **総確認ページ数**: {len(pages)} ページ（HTTP 200: {len(ok_pages)} / 失敗・未取得: {len(fail_pages)}）')
lines.append(f'- **課数**: {len(data["lessons"])} 課（第1課〜第22課）')
grammar_total = sum(len(l['grammar_items']) for l in data['lessons'].values())
lines.append(f'- **文法事項総数（目次掲載分）**: {grammar_total} 項目')
lines.append('- **特記事項**: 第10課の目次（`L10_toc.html`）は `L10_6.html` の次が `L10_8.html` となっており `L10_7.html` へのリンクが存在しないが、直接アクセスしたところHTTP 200でページ自体は存在することが確認できた（目次未掲載ページとして記録）。\n')

lines.append('## 3. 全課シラバス・文法事項・学習目標一覧\n')
for lid in sorted(data['lessons'].keys()):
    l = data['lessons'][lid]
    lines.append(f'### {lid}: {l["title"]} ([TOP]({l["top_url"]}) / [TOC]({l["toc_url"]}))')
    lines.append(f'- **単語チェック項目数**: {len(l["vocab_items"])} 語')
    lines.append('- **文法事項**:')
    for idx, g in enumerate(l['grammar_items'], 1):
        lines.append(f'  {idx}. {g["label"]} — [{g["url"]}]({g["url"]}) (HTTP {g["status"]})')
    lines.append('- **練習問題形式・目標**:')
    for ex in l['exercises']:
        instr = ' '.join(ex['instruction']).strip()
        lines.append(f'  - {ex["label"]}（設問数目安: {ex["item_count"]}）: {instr} — [{ex["url"]}]({ex["url"]})')
    lines.append('')

lines.append('## 4. 全調査URL一覧\n')
lines.append('| No | 課 | 種別 | 相対URL | タイトル/ラベル | HTTP | 状況 |')
lines.append('|---:|:---:|:---:|---|---|---:|:---:|')
for i, p in enumerate(pages, 1):
    les = f'L{p["lesson"]:02d}' if p['lesson'] else '-'
    title = (p['toc_label'] or p['title'] or '').replace('|', '｜').replace('\n', ' ')
    stat = '確認済み' if p['status'] == 200 else f'未取得({p["error"]})'
    lines.append(f'| {i} | {les} | {p["type"]} | [{p["rel_url"]}]({p["url"]}) | {title} | {p["status"]} | {stat} |')

with open('RESEARCH.md', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines) + '\n')

for lid in sorted(data['lessons'].keys()):
    l = data['lessons'][lid]
    gs = ' | '.join(g['label'] for g in l['grammar_items'])
    exs = ' ; '.join(f"{e['label']}:{' '.join(e['instruction'])}" for e in l['exercises'])
    print(f"{lid} ({len(l['vocab_items'])}w): {gs}")
    print(f"   EX: {exs}")
    print(f"   VOCAB: {', '.join(l['vocab_items'])}")
