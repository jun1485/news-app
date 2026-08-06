// RSS 수집 + Gemini 요약 결과를 Cloudflare KV에 적재
// 실행: node scripts/generate-digests.mjs [카테고리...]
// 필요 환경변수: GEMINI_API_KEY, CLOUDFLARE_API_TOKEN

const ACCOUNT_ID = "30046f5409b8d0469e58dae9e109eb05";
const KV_NAMESPACE_ID = "c998e02f23a04dd799662a61b86e56bb";
const GEMINI_MODEL = "gemini-3.1-flash-lite";
const MAX_ITEMS = 6;
const CATEGORY_TTL = 93600;
const POOL_LIMIT = 40;
const INDEX_KEY = "idx:v1";

const RSS_SOURCES = {
  "정치": [{ u: "https://www.yna.co.kr/rss/politics.xml", n: "연합뉴스" }],
  "경제": [
    { u: "https://www.yna.co.kr/rss/economy.xml", n: "연합뉴스" },
    { u: "https://www.yna.co.kr/rss/industry.xml", n: "연합뉴스" },
  ],
  "IT/과학": [
    { u: "https://rss.etnews.com/Section901.xml", n: "전자신문" },
    { u: "https://www.yna.co.kr/rss/industry.xml", n: "연합뉴스" },
  ],
  "사회": [{ u: "https://www.yna.co.kr/rss/society.xml", n: "연합뉴스" }],
  "세계": [{ u: "https://www.yna.co.kr/rss/international.xml", n: "연합뉴스" }],
  "문화/연예": [
    { u: "https://www.yna.co.kr/rss/culture.xml", n: "연합뉴스" },
    { u: "https://www.yna.co.kr/rss/entertainment.xml", n: "연합뉴스" },
  ],
  "스포츠": [{ u: "https://www.yna.co.kr/rss/sports.xml", n: "연합뉴스" }],
};

const SUMMARY_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      index: { type: "INTEGER" },
      headline: { type: "STRING" },
      summary: { type: "STRING" },
    },
    required: ["index", "headline", "summary"],
    propertyOrdering: ["index", "headline", "summary"],
  },
};

// 한국 기준 오늘 날짜 추출
function todayKst() {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// XML 텍스트에서 CDATA·엔티티·태그 제거
function rssText(raw) {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// RSS XML에서 기사 목록 추출
function parseRss(xml, sourceName) {
  const out = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const pick = (tag) => {
      const mm = new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">").exec(block);
      return mm ? rssText(mm[1]) : "";
    };
    const title = pick("title");
    const link = pick("link");
    if (!title || !/^https?:\/\//.test(link)) continue;
    const t = Date.parse(pick("pubDate"));
    out.push({
      title,
      link,
      description: pick("description").slice(0, 500),
      publishedAt: Number.isFinite(t) ? new Date(t + 9 * 3600 * 1000).toISOString().slice(0, 10) : null,
      sourceName,
    });
  }
  return out;
}

// 소스 1건 수집
async function fetchSource(src) {
  try {
    const res = await fetch(src.u, {
      headers: { "user-agent": "Mozilla/5.0 (compatible; NewsDigestBot/1.0)" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) {
      console.error(`  rss http ${res.status}: ${src.u}`);
      return [];
    }
    return parseRss(await res.text(), src.n);
  } catch (err) {
    console.error(`  rss error ${src.u}: ${err}`);
    return [];
  }
}

// 카테고리 오늘 기사 수집
async function collectToday(category, today) {
  const groups = await Promise.all((RSS_SOURCES[category] || []).map(fetchSource));
  const seen = new Set();
  return groups
    .flat()
    .filter((a) => (seen.has(a.link) ? false : (seen.add(a.link), true)))
    .filter((a) => a.publishedAt === today);
}

// 요약 프롬프트 구성
function buildPrompt(articles, category) {
  const list = articles.map((a, i) => `[${i}] ${a.title}\n${a.description}`).join("\n\n");
  return [
    `아래는 오늘 국내 언론에 게시된 '${category}' 분야 기사 목록이다.`,
    `이 중 가장 중요하고 서로 주제가 겹치지 않는 ${MAX_ITEMS}건을 골라 한국어로 정리해줘.`,
    ``,
    `각 항목 규칙:`,
    `- index: 위 목록의 번호를 그대로.`,
    `- headline: 원문 제목 복사 대신 핵심 요지를 담아 새로 작성한 한국어 제목.`,
    `- summary: 한국어 3~5문장(250~400자) 요약. 핵심 사실, 구체 수치와 비교 기준, 배경 맥락, 파급 효과나 향후 일정 순으로 담아라. 원문 문장 복붙 금지, 직접 인용 금지, 반드시 자기 문장으로 재구성.`,
    `- 목록에 없는 내용을 지어내지 마라.`,
    `JSON 배열만 출력.`,
    ``,
    list,
  ].join("\n");
}

// Gemini 요약 생성 — 메타데이터는 RSS 원본 유지
async function summarize(apiKey, articles, category) {
  const pool = articles.slice(0, POOL_LIMIT);
  const prompt = buildPrompt(pool, category);
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    let res;
    try {
      res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          signal: AbortSignal.timeout(60000),
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", responseSchema: SUMMARY_SCHEMA },
          }),
        },
      );
    } catch (err) {
      console.error(`  gemini error (${attempt}): ${err}`);
      continue;
    }
    if (!res.ok) {
      console.error(`  gemini http ${res.status} (${attempt}): ${(await res.text()).slice(0, 160)}`);
      continue;
    }
    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
    let arr;
    try {
      arr = JSON.parse(text);
    } catch {
      continue;
    }
    if (!Array.isArray(arr)) continue;
    const items = [];
    const used = new Set();
    for (const row of arr) {
      const idx = Number(row?.index);
      const src = pool[idx];
      if (!src || used.has(idx)) continue;
      const headline = String(row.headline ?? "").trim();
      const summary = String(row.summary ?? "").trim();
      if (!headline || !summary) continue;
      used.add(idx);
      items.push({
        headline,
        summary,
        sourceName: src.sourceName,
        sourceUrl: src.link,
        publishedAt: src.publishedAt,
      });
      if (items.length >= MAX_ITEMS) break;
    }
    if (items.length > 0) return items;
  }
  return [];
}

// KV 값 적재
async function putKvValue(token, key, value, ttl) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}?expiration_ttl=${ttl}`;
  const body = new FormData();
  body.append("value", value);
  body.append("metadata", "{}");
  const res = await fetch(url, { method: "PUT", headers: { Authorization: `Bearer ${token}` }, body });
  const json = await res.json();
  if (!json.success) throw new Error(`KV put 실패(${key}): ${JSON.stringify(json.errors)}`);
}

// 카테고리 다이제스트 적재
async function putCategory(token, category, items) {
  const value = JSON.stringify({
    generatedAt: new Date().toISOString(),
    items: items.map((it, i) => ({ ...it, id: `cat-${category}-${i}`, category })),
  });
  await putKvValue(token, `cat:v1:${category}`, value, CATEGORY_TTL);
}

// KV 값 조회
async function getKvValue(token, key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${encodeURIComponent(key)}`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// 키워드 검색용 전체 기사 인덱스 적재 — 당일분 누적, 요약 없이 제목·출처만
async function putIndex(token, articles, today) {
  const seen = new Set();
  const items = [];
  for (const a of articles) {
    if (seen.has(a.link)) continue;
    seen.add(a.link);
    items.push({
      headline: a.title,
      summary: "",
      sourceName: a.sourceName,
      sourceUrl: a.link,
      publishedAt: a.publishedAt,
      category: a.category,
      // 키워드 매칭 전용 본문 발췌 — 화면 표시 미사용
      q: a.description.slice(0, 220),
    });
  }
  // 앞선 실행분 중 당일 기사를 유지해 RSS에서 밀려난 기사도 검색 가능하게 누적
  const prev = await getKvValue(token, INDEX_KEY);
  let carried = 0;
  if (prev && Array.isArray(prev.items)) {
    for (const it of prev.items) {
      if (it.publishedAt !== today || seen.has(it.sourceUrl)) continue;
      seen.add(it.sourceUrl);
      items.push(it);
      carried += 1;
    }
  }
  const value = JSON.stringify({ generatedAt: new Date().toISOString(), items });
  await putKvValue(token, INDEX_KEY, value, CATEGORY_TTL);
  return { total: items.length, carried };
}

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!apiKey || !token) {
    console.error("GEMINI_API_KEY / CLOUDFLARE_API_TOKEN 환경변수 필요");
    process.exit(1);
  }
  const targets = process.argv.slice(2).length > 0 ? process.argv.slice(2) : Object.keys(RSS_SOURCES);
  const today = todayKst();
  console.log(`오늘(KST): ${today} / 대상 ${targets.length}개`);
  let failed = 0;
  const indexPool = [];
  for (const category of targets) {
    if (!RSS_SOURCES[category]) {
      console.error(`${category}: 알 수 없는 카테고리`);
      failed += 1;
      continue;
    }
    const articles = await collectToday(category, today);
    if (articles.length === 0) {
      console.error(`${category}: 오늘 기사 0건 — 건너뜀`);
      failed += 1;
      continue;
    }
    indexPool.push(...articles.map((a) => ({ ...a, category })));
    const items = await summarize(apiKey, articles, category);
    if (items.length === 0) {
      console.error(`${category}: 요약 실패`);
      failed += 1;
      continue;
    }
    await putCategory(token, category, items);
    const avg = Math.round(items.reduce((s, i) => s + i.summary.length, 0) / items.length);
    console.log(`${category}: 수집 ${articles.length}건 → 적재 ${items.length}건 (평균 요약 ${avg}자)`);
  }
  if (indexPool.length > 0) {
    const { total, carried } = await putIndex(token, indexPool, today);
    console.log(`키워드 인덱스: ${total}건 적재 (이전 실행분 유지 ${carried}건)`);
  }
  if (failed > 0) {
    console.error(`실패 ${failed}건`);
    process.exit(1);
  }
  console.log("전체 완료");
}

await main();
