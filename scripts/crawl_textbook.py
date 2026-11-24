import json
import os
import re
import urllib.request
import urllib.error
from html.parser import HTMLParser
from urllib.parse import urljoin

BASE_URL = "https://hanyujiaocai.jinkan.kyoto-u.ac.jp/2018shanghai/2018CALL/"
OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".cache")
os.makedirs(OUT_DIR, exist_ok=True)


class PageExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.links = []
        self._in_a = False
        self._href = None
        self._a_text = []
        self._in_title = False
        self.title = []
        self._in_h1 = False
        self.h1 = []
        self._in_h2 = False
        self.h2 = []
        self._in_h3 = False
        self.h3 = []
        self._in_li = False
        self._li_text = []
        self.list_items = []
        self._in_p = False
        self._p_text = []
        self.paragraphs = []
        self._skip = False

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag in ("script", "style"):
            self._skip = True
            return
        if tag == "a":
            self._in_a = True
            self._href = d.get("href")
            self._a_text = []
        elif tag == "title":
            self._in_title = True
        elif tag == "h1":
            self._in_h1 = True
        elif tag == "h2":
            self._in_h2 = True
        elif tag == "h3":
            self._in_h3 = True
        elif tag == "li":
            self._in_li = True
            self._li_text = []
        elif tag == "p":
            self._in_p = True
            self._p_text = []

    def handle_data(self, data):
        if self._skip:
            return
        text = re.sub(r"\s+", " ", data)
        if self._in_a:
            self._a_text.append(text.strip())
        if self._in_title:
            self.title.append(text.strip())
        if self._in_h1:
            self.h1.append(text.strip())
        if self._in_h2:
            self.h2.append(text.strip())
        if self._in_h3:
            self.h3.append(text.strip())
        if self._in_li:
            self._li_text.append(text.strip())
        if self._in_p:
            self._p_text.append(text.strip())

    def handle_endtag(self, tag):
        if tag in ("script", "style"):
            self._skip = False
            return
        if tag == "a" and self._in_a:
            if self._href:
                self.links.append({
                    "href": self._href,
                    "text": " ".join(t for t in self._a_text if t).strip()
                })
            self._in_a = False
            self._href = None
        elif tag == "title":
            self._in_title = False
        elif tag == "h1":
            self._in_h1 = False
        elif tag == "h2":
            self._in_h2 = False
        elif tag == "h3":
            self._in_h3 = False
        elif tag == "li" and self._in_li:
            item = " ".join(t for t in self._li_text if t).strip()
            if item:
                self.list_items.append(item)
            self._in_li = False
        elif tag == "p" and self._in_p:
            p = " ".join(t for t in self._p_text if t).strip()
            if p:
                self.paragraphs.append(p)
            self._in_p = False


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Educational Research)"})
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            raw = resp.read().decode("utf-8", errors="replace")
            return resp.status, raw, None
    except urllib.error.HTTPError as e:
        return e.code, "", str(e)
    except Exception as e:
        return 0, "", str(e)


def classify_page(href, toc_label=""):
    if href == "index.html":
        return "index"
    if href == "download.html":
        return "download"
    if href.endswith("_top.html"):
        return "lesson_top"
    if href.endswith("_toc.html"):
        return "lesson_toc"
    if "_1.html" in href:
        return "text"
    if "_2.html" in href:
        return "vocab"
    if "文法" in toc_label:
        return "grammar"
    if "練習" in toc_label:
        return "exercise"
    return "other"


def main():
    results = {
        "base_url": BASE_URL,
        "pages": [],
        "lessons": {},
        "missing_or_failed": []
    }

    visited = set()

    def record_page(rel_url, lesson_num, page_type, toc_label=""):
        full_url = urljoin(BASE_URL, rel_url)
        if full_url in visited:
            return None
        visited.add(full_url)
        status, html, err = fetch(full_url)
        parser = PageExtractor()
        if html:
            parser.feed(html)
        title = " ".join(t for t in parser.title if t) or " ".join(t for t in parser.h1 if t)
        entry = {
            "url": full_url,
            "rel_url": rel_url,
            "lesson": lesson_num,
            "type": page_type,
            "toc_label": toc_label,
            "status": status,
            "error": err,
            "title": title,
            "h1": " ".join(t for t in parser.h1 if t),
            "h2": [t for t in parser.h2 if t],
            "h3": [t for t in parser.h3 if t],
            "links": parser.links,
            "list_items_count": len(parser.list_items),
            "list_items_sample": parser.list_items[:8] if page_type != "vocab" else parser.list_items,
            "paragraphs_head": parser.paragraphs[:4],
        }
        results["pages"].append(entry)
        if status != 200:
            results["missing_or_failed"].append({
                "url": full_url,
                "lesson": lesson_num,
                "type": page_type,
                "status": status,
                "error": err
            })
        return entry

    # 1. index & download
    idx = record_page("index.html", None, "index", "トップページ")
    record_page("download.html", None, "download", "ダウンロード用音声")

    # Extract lesson top links from index
    lesson_tops = []
    if idx:
        for lk in idx["links"]:
            m = re.match(r"L(\d+)_top\.html", lk["href"])
            if m:
                lesson_tops.append((int(m.group(1)), lk["href"], lk["text"]))

    # 2. For each lesson, fetch top, toc, and all linked pages
    for lesson_num, top_href, top_text in sorted(lesson_tops):
        top_entry = record_page(top_href, lesson_num, "lesson_top", top_text)
        toc_href = f"L{lesson_num}_toc.html"
        toc_entry = record_page(toc_href, lesson_num, "lesson_toc", f"第{lesson_num}課 目次")

        lesson_info = {
            "lesson": lesson_num,
            "top_url": urljoin(BASE_URL, top_href),
            "toc_url": urljoin(BASE_URL, toc_href),
            "title": top_text,
            "grammar_items": [],
            "vocab_items": [],
            "exercises": [],
            "other_pages": []
        }

        if toc_entry:
            for lk in toc_entry["links"]:
                href = lk["href"]
                label = lk["text"]
                if href == "index.html":
                    continue
                ptype = classify_page(href, label)
                page = record_page(href, lesson_num, ptype, label)
                if ptype == "grammar":
                    lesson_info["grammar_items"].append({
                        "label": label,
                        "url": urljoin(BASE_URL, href),
                        "status": page["status"] if page else None,
                        "title": page["title"] if page else ""
                    })
                elif ptype == "vocab" and page:
                    lesson_info["vocab_items"] = page["list_items_sample"]
                elif ptype == "exercise" and page:
                    lesson_info["exercises"].append({
                        "label": label,
                        "url": urljoin(BASE_URL, href),
                        "status": page["status"],
                        "instruction": page["paragraphs_head"][:2],
                        "item_count": page["list_items_count"]
                    })
                else:
                    lesson_info["other_pages"].append({
                        "label": label,
                        "url": urljoin(BASE_URL, href),
                        "type": ptype,
                        "status": page["status"] if page else None
                    })

        results["lessons"][f"L{lesson_num:02d}"] = lesson_info

    # Probe L10_7.html specifically because L10_toc skipped 7 (L10_6 -> L10_8)
    record_page("L10_7.html", 10, "probe_missing", "L10_7 probe")

    out_path = os.path.join(OUT_DIR, "textbook_research.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)

    print(f"Crawled {len(results['pages'])} pages. Failures/missing: {len(results['missing_or_failed'])}")
    for m in results["missing_or_failed"]:
        print("  FAIL:", m)


if __name__ == "__main__":
    main()
