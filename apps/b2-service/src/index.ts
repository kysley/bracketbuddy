import dotenv from "dotenv";
import Puppeteer from "puppeteer";
import * as cheerio from "cheerio";
import Fastify, { FastifyRequest } from "fastify";
import FastifyCors from "fastify-cors";

dotenv.config({ path: `${process.cwd()}/../../.env` });

const cache = new Map();
let page: Puppeteer.Page;

async function crawlTheme(uri: string) {
  await page.goto(uri);

  const content = await page.content();

  const $ = cheerio.load(content);

  const examples = $(".css-swve6m svg.css-ahoycg").toArray();

  let idx = 0;
  return examples.map((elem) => {
    const dict = extractColourDict(elem.childNodes);
    const title = extractName($, idx);

    console.log(dict);

    const sortedDict = Object.keys(dict).sort((key1, key2) =>
      dict[key1] > dict[key2] ? 1 : -1
    );

    idx++;

    return {
      title,
      dict: sortedDict,
    };
  });
}

function extractName($: cheerio.CheerioAPI, idx: number) {
  // @ts-expect-error
  return $(".css-1s2194k")[idx].children[0].nodeValue;
}

function extractColourDict(texts: cheerio.Node[]) {
  const ddict: Record<string, number> = {};

  texts.forEach((textEl, idx) => {
    //@ts-expect-error
    const tspans = [...textEl.childNodes];

    // Skip the comment colour
    if (idx === 8) return;

    tspans.forEach((tspan) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      //@ts-ignore
      const styleAttr = tspan.attribs.style as string;
      const hex = styleAttr.split(";")[0].substring(6);
      if (!ddict[hex]) {
        ddict[hex] = 0;
      }
      ddict[hex] += 1;
    });
  });

  return ddict;
}

const fastify = Fastify({ trustProxy: true });

fastify.register(FastifyCors, {
  origin: [
    "http://localhost:8800",
    "https://b2.e8y.fun",
    "http://localhost:3000",
  ],
});

type PeerManagerGetRequest = FastifyRequest<{
  Querystring: {
    url: string;
  };
}>;
fastify.get("/", async (req: PeerManagerGetRequest, res) => {
  const { url } = req.query;
  if (!url) return res.status(404).send();

  if (cache.has(url)) {
    res.send(cache.get(url));
    return;
  }

  const resp = await crawlTheme(url);
  cache.set(url, resp);

  res.send(resp);

  // page.close();
});

// fastify.get("/health", async () => {
//   // Random search that only has one theme
//   // this is a super fragile health test tbfh
//   const resp = await crawlTheme(encodeURI("Taarú Teranga"));

//   if (resp["#000000"] !== 32) {
//     return false;
//   }
//   return true;
// });

const start = async () => {
  try {
    const browser = await Puppeteer.launch({ headless: true });
    page = await browser.newPage();
    await fastify.listen(process.env.SERVICE_PORT || 3600);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
};

start();
