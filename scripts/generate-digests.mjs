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
const KEYWORD_CACHE_PREFIX = "kw:v1:";
const EXTRA_POOL_KEY = "pool:v1:extra";
const EXTRA_BATCH = 12;

const RSS_SOURCES = {
  "정치": [{ u: "https://www.yna.co.kr/rss/politics.xml", n: "연합뉴스" }],
  "경제": [
    { u: "https://www.yna.co.kr/rss/economy.xml", n: "연합뉴스" },
    { u: "https://www.yna.co.kr/rss/industry.xml", n: "연합뉴스" },
    { u: "https://www.hankyung.com/feed/it", n: "한국경제" },
  ],
  "IT/과학": [
    { u: "https://feeds.feedburner.com/zdkorea", n: "ZDNet Korea" },
    { u: "https://www.hankyung.com/feed/it", n: "한국경제" },
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

// 한국어 제목·요약을 생성할 해외 소스
const FOREIGN_SOURCES = [
  { u: "https://techcrunch.com/feed/", n: "TechCrunch" },
  { u: "http://feeds.arstechnica.com/arstechnica/index", n: "Ars Technica" },
  { u: "https://www.theverge.com/rss/index.xml", n: "The Verge" },
];

// 키워드 검색 인덱스에만 담는 소스 — 요약 대상 아님
const INDEX_ONLY_SOURCES = [{ u: "https://rss.mt.co.kr/mt_news.xml", n: "머니투데이" }];

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

// RSS·Atom 피드에서 기사 목록 추출
function parseRss(xml, sourceName) {
  const out = [];
  const re = /<(item|entry)[\s>]([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[2];
    const pick = (tag) => {
      const mm = new RegExp("<" + tag + "[^>]*>([\\s\\S]*?)</" + tag + ">").exec(block);
      return mm ? rssText(mm[1]) : "";
    };
    const title = pick("title");
    // Atom은 link를 href 속성으로 제공
    let link = pick("link");
    if (!/^https?:\/\//.test(link)) {
      const href = /<link[^>]*href="([^"]+)"/.exec(block);
      link = href ? href[1] : "";
    }
    if (!title || !/^https?:\/\//.test(link)) continue;
    const t = Date.parse(pick("pubDate") || pick("published") || pick("updated") || pick("dc:date"));
    out.push({
      title,
      link,
      description: (pick("description") || pick("summary") || pick("content")).slice(0, 500),
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
function buildPrompt(articles, category, wantItems) {
  const list = articles.map((a, i) => `[${i}] ${a.title}\n${a.description}`).join("\n\n");
  return [
    `아래는 오늘 게시된 '${category}' 기사 목록이다. 영문 기사가 섞여 있을 수 있다.`,
    `이 중 가장 중요하고 서로 주제가 겹치지 않는 ${wantItems}건을 골라 한국어로 정리해줘.`,
    ``,
    `각 항목 규칙:`,
    `- index: 위 목록의 번호를 그대로.`,
    `- headline: 반드시 한국어 제목. 영문 기사는 한국어로 번역해 작성하고, 원문 제목 복사 대신 핵심 요지를 담아 새로 써라.`,
    `- summary: 반드시 한국어. **2문단 이상**으로 쓰고 문단은 빈 줄(\\n\\n)로 구분해라.`,
    `    · 1문단: 핵심 사실과 구체 수치(비교 기준 포함).`,
    `    · 2문단: 배경 맥락과 파급 효과, 향후 일정.`,
    `    · 각 문단 맨 앞에 내용에 어울리는 이모지 1개를 붙여라(📈 💰 🏛️ ⚖️ 🤖 🔬 ⚽ 🎬 🌍 등에서 적절히 선택).`,
    `    · 문단당 2~3문장, 전체 400~600자. 원문 문장 복붙 금지, 직접 인용 금지, 자기 문장으로 재구성.`,
    `- 목록에 없는 내용을 지어내지 마라.`,
    `JSON 배열만 출력.`,
    ``,
    list,
  ].join("\n");
}

// Gemini 요약 생성 — 메타데이터는 RSS 원본 유지
async function summarize(apiKey, articles, category, wantItems = MAX_ITEMS) {
  const pool = articles.slice(0, POOL_LIMIT);
  const prompt = buildPrompt(pool, category, wantItems);
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
            generationConfig: { responseMimeType: "application/json", responseSchema: SUMMARY_SCHEMA, maxOutputTokens: 32768 },
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
      if (!/[가-힣]/.test(headline) || !/[가-힣]/.test(summary)) continue;
      used.add(idx);
      items.push({
        headline,
        summary,
        sourceName: src.sourceName,
        sourceUrl: src.link,
        publishedAt: src.publishedAt,
      });
      if (items.length >= wantItems) break;
    }
    if (items.length > 0) return items;
  }
  return [];
}

// 전체 기사 한국어 제목·요약 생성
async function summarizeAll(apiKey, articles, category) {
  const items = [];
  for (let i = 0; i < articles.length; i += EXTRA_BATCH) {
    const slice = articles.slice(i, i + EXTRA_BATCH);
    const batchItems = await summarize(apiKey, slice, category, slice.length);
    const summarizedUrls = new Set(batchItems.map((item) => item.sourceUrl));
    items.push(...batchItems);
    for (const article of slice) {
      if (summarizedUrls.has(article.link)) continue;
      const [item] = await summarize(apiKey, [article], category, 1);
      if (item) items.push(item);
    }
  }
  return items;
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

// 키워드 검색 결과 캐시 삭제
async function deleteKeywordCaches(token) {
  const keys = [];
  let cursor = "";
  do {
    const params = new URLSearchParams({ prefix: KEYWORD_CACHE_PREFIX, limit: "1000" });
    if (cursor) params.set("cursor", cursor);
    const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/keys?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json();
    if (!json.success) throw new Error(`KV 키 목록 조회 실패: ${JSON.stringify(json.errors)}`);
    keys.push(...json.result.map((item) => item.name));
    cursor = json.result_info?.cursor ?? "";
  } while (cursor);
  if (keys.length === 0) return 0;
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/bulk`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(keys),
  });
  const json = await res.json();
  if (!json.success) throw new Error(`KV 키워드 캐시 삭제 실패: ${JSON.stringify(json.errors)}`);
  return keys.length;
}

// 키워드 검색용 전체 기사 인덱스 적재
async function putIndex(token, articles, today) {
  const seen = new Set();
  const items = [];
  for (const a of articles) {
    const sourceUrl = a.sourceUrl ?? a.link;
    if (seen.has(sourceUrl)) continue;
    seen.add(sourceUrl);
    items.push({
      headline: a.headline ?? a.title,
      summary: a.summary ?? "",
      sourceName: a.sourceName,
      sourceUrl,
      publishedAt: a.publishedAt,
      category: a.category,
      // 키워드 매칭 전용 본문 발췌 — 화면 표시 미사용
      q: (a.q ?? a.summary ?? a.description).slice(0, 220),
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
  // 인덱스 전용 소스 — 검색 범위만 확대
  const idxGroups = await Promise.all(INDEX_ONLY_SOURCES.map(fetchSource));
  const idxOnly = idxGroups.flat().filter((a) => a.publishedAt === today);
  if (idxOnly.length > 0) {
    indexPool.push(...idxOnly.map((a) => ({ ...a, category: "국내" })));
    console.log(`인덱스 전용 소스: 오늘 ${idxOnly.length}건 추가`);
  }
  // 해외 소스 — 인덱스 적재 + 한국어 제목·요약 생성
  const extraGroups = await Promise.all(FOREIGN_SOURCES.map(fetchSource));
  const seenExtra = new Set();
  const extra = extraGroups
    .flat()
    .filter((a) => a.publishedAt === today)
    .filter((a) => (seenExtra.has(a.link) ? false : (seenExtra.add(a.link), true)));
  if (extra.length > 0) {
    console.log(`해외 소스: 오늘 ${extra.length}건 추가`);
    const extraItems = await summarizeAll(apiKey, extra, "해외·IT");
    if (extraItems.length !== extra.length)
      throw new Error(`해외·IT 한국어 생성 누락: ${extraItems.length}/${extra.length}건`);
    const extraByUrl = new Map(extra.map((article) => [article.link, article]));
    indexPool.push(
      ...extraItems.map((item) => {
        const original = extraByUrl.get(item.sourceUrl);
        return { ...item, category: "해외·IT", q: `${original.title} ${original.description}` };
      }),
    );
    const value = JSON.stringify({
      generatedAt: new Date().toISOString(),
      items: extraItems.map((it, i) => ({ ...it, id: `ext-${i}`, category: "해외·IT" })),
    });
    await putKvValue(token, EXTRA_POOL_KEY, value, CATEGORY_TTL);
    const avg = Math.round(extraItems.reduce((sum, i) => sum + i.summary.length, 0) / extraItems.length);
    console.log(`해외·IT 요약 풀: ${extraItems.length}건 적재 (평균 요약 ${avg}자)`);
  }
  if (indexPool.length > 0) {
    const { total, carried } = await putIndex(token, indexPool, today);
    console.log(`키워드 인덱스: ${total}건 적재 (이전 실행분 유지 ${carried}건)`);
    const deleted = await deleteKeywordCaches(token);
    console.log(`키워드 캐시: ${deleted}건 삭제`);
  }
  if (failed > 0) {
    console.error(`실패 ${failed}건`);
    process.exit(1);
  }
  console.log("전체 완료");
}

await main();
