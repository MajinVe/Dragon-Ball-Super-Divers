/**
 * Traduction japonais → français.
 * - DeepL si la variable DEEPL_API_KEY est définie (meilleure qualité, offre gratuite disponible) ;
 * - sinon l'API publique MyMemory (gratuite, sans clé, qualité correcte).
 * Un glossaire Dragon Ball est appliqué avant traduction pour garder les bons noms.
 */

const GLOSSARY: [RegExp, string][] = [
  [/(\d+)弾/g, "Série $1 "],
  [/ドラゴンボールスーパーダイバーズ|スーパーダイバーズ/g, "Super Divers"],
  [/ドラゴンボール/g, "Dragon Ball"],
  [/アドバンスパック/g, "Advance Pack"], [/ファーストパック/g, "First Pack"],
  [/ゴッドレア/g, "God Rare"], [/シークレット/g, "Secret"], [/パラレル/g, "parallèle"], [/エクストラレア/g, "Extra Rare"],
  [/ヒストリーダイブ/g, "History Dive"], [/ドカバキダイブ/g, "Dokabaki Dive"], [/チャレンジダイブ/g, "Challenge Dive"],
  [/ストライクバトルラッシュ/g, "Strike Battle Rush"], [/スーパーダイバーズアリーナ/g, "Super Divers Arena"],
  [/プレミアムバンダイ/g, "Premium Bandai"], [/受注開始/g, " : ouverture des précommandes"],
  [/超サイヤ人/g, "Super Saiyan"], [/サイヤ人/g, "Saiyan"], [/かめはめ波/g, "Kamehameha"], [/気功砲/g, "Kikoho"],
  [/孫悟空/g, "Son Goku"], [/悟空/g, "Goku"], [/孫悟飯/g, "Son Gohan"], [/悟飯/g, "Gohan"], [/悟天/g, "Goten"],
  [/ベジータ/g, "Vegeta"], [/トランクス/g, "Trunks"], [/ピッコロ/g, "Piccolo"], [/天津飯/g, "Tenshinhan"],
  [/クリリン/g, "Krilin"], [/ヤムチャ/g, "Yamcha"], [/フリーザ/g, "Freezer"], [/セル/g, "Cell"], [/魔人ブウ|ブウ/g, "Boo"],
  [/ビルス/g, "Beerus"], [/ウイス/g, "Whis"], [/ゴジータ/g, "Gogeta"], [/ベジット/g, "Vegetto"], [/ゴテンクス/g, "Gotenks"],
  [/ジレン/g, "Jiren"], [/ブロリー/g, "Broly"], [/ゴクウブラック/g, "Goku Black"], [/ザマス/g, "Zamasu"], [/ヒット/g, "Hit"],
  [/人造人間(\d+)号/g, "C-$1"], [/ダイマ|DAIMA/g, "Daima"], [/アバター/g, "avatar"],
];

function prepare(t: string) {
  let out = t;
  for (const [re, rep] of GLOSSARY) out = out.replace(re, rep);
  return out.replace(/\s{2,}/g, " ").trim();
}

async function deepl(texts: string[], key: string) {
  const host = key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com";
  const res = await fetch(`${host}/v2/translate`, {
    method: "POST",
    headers: { Authorization: `DeepL-Auth-Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ text: texts, source_lang: "JA", target_lang: "FR" }),
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`DeepL HTTP ${res.status}`);
  const json = (await res.json()) as { translations: { text: string }[] };
  return json.translations.map((t) => t.text);
}

async function myMemory(text: string) {
  const email = process.env.MYMEMORY_EMAIL ? `&de=${encodeURIComponent(process.env.MYMEMORY_EMAIL)}` : "";
  const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ja|fr${email}`, {
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);
  const json = (await res.json()) as { responseStatus: number; responseData: { translatedText: string } };
  if (json.responseStatus !== 200) throw new Error("MyMemory : quota ou erreur");
  return json.responseData.translatedText;
}

const hasJapanese = (t: string) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(t);

export async function translateJaToFr(texts: string[]): Promise<(string | null)[]> {
  const prepared = texts.map(prepare);
  const key = process.env.DEEPL_API_KEY;
  if (key) {
    try { return await deepl(prepared, key); } catch { /* repli sur MyMemory */ }
  }
  const out: (string | null)[] = [];
  for (const t of prepared) {
    if (!hasJapanese(t)) { out.push(t); continue; }
    try { out.push(await myMemory(t)); } catch { out.push(null); }
  }
  return out;
}
