// APTARNAUJANTIS DARBUOTOJAS (service worker).
//
// Kam jo reikia: įsidėjus žaidimą į telefono ekraną jis turi atsidaryti greitai
// ir be naršyklės juostų. Failai (Phaser vien sveria 1,2 MB) laikomi įrenginyje,
// tad antrą kartą nebesisiunčia.
//
// SVARBIAUSIA TAISYKLĖ: naujos versijos negalima užstrigdyti.
//   • `index.html` visada imamas IŠ TINKLO, ir tik neturint ryšio — iš atminties.
//     Jame surašyti failų vardai, tad įkėlus pataisymą jie pasiekia žaidėją.
//   • `/assets/…` failų varduose yra maiša (index-BdMGoUWR.js), tad tas pats
//     vardas visada reiškia tą patį turinį — juos saugu imti iš atminties.
//   • Viskas kita (Supabase, kiti serveriai) čia net neliečiama.

const CACHE = "mano-ukis-v1";
// Kiek failų daugiausia laikom. Kiekviena nauja versija atneša naujus vardus,
// tad be ribos atmintis augtų be galo.
const MAX_IRASU = 60;

self.addEventListener("install", (event) => {
  // Naujas darbuotojas perima iš karto: `index.html` vis tiek imamas iš tinklo,
  // tad seno ir naujo turinio susimaišyti negali.
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const vardai = await caches.keys();
      await Promise.all(vardai.filter((v) => v !== CACHE).map((v) => caches.delete(v)));
      await self.clients.claim();
    })()
  );
});

async function apkarpyk(cache) {
  const raktai = await cache.keys();
  if (raktai.length <= MAX_IRASU) return;
  // keys() grąžina įdėjimo tvarka, tad seniausi yra priekyje. Puslapio įrašo
  // netrinam niekada — be jo neveiktų atsidarymas be ryšio.
  for (const raktas of raktai.slice(0, raktai.length - MAX_IRASU)) {
    if (raktas.url.endsWith("/index.html")) continue;
    // Žemėlapio irgi netrinam: be jo nebeliktų pasaulio, o siunčiasi jis 610 KB.
    if (raktas.url.includes("/zemelapis/")) continue;
    await cache.delete(raktas);
  }
}

// Puslapis atmintyje laikomas VIENU raktu. Kitaip kiekvienas kreipinys su kiek
// kitokiomis antraštėmis įrašydavo dar vieną to paties puslapio kopiją.
const PUSLAPIO_RAKTAS = "./index.html";
// `ignoreVary` — antraštės tegul nelemia, ar radom; failo turinys tas pats.
const PAIESKA = { ignoreVary: true };

/**
 * Puslapis: pirma tinklas, o be ryšio — tai, kas išsaugota.
 *
 * Įrašomas ne pats atsakymas, o jo NUVALYTA kopija. Serveriai prie puslapio
 * prisega antraštę `Vary`, ir tada naršyklė kiekvieną kreipinį su kitokiomis
 * antraštėmis laiko atskiru įrašu — atmintyje kaupdavosi to paties puslapio
 * kopijos. Nuvalytas atsakymas visada užima vieną vietą.
 */
async function puslapis(request) {
  const cache = await caches.open(CACHE);
  try {
    const atsakymas = await fetch(request);
    if (atsakymas && atsakymas.ok) {
      const kunas = await atsakymas.clone().arrayBuffer();
      const kopija = new Response(kunas, {
        status: atsakymas.status,
        headers: { "Content-Type": atsakymas.headers.get("Content-Type") || "text/html" },
      });
      await cache.delete(PUSLAPIO_RAKTAS, PAIESKA);
      await cache.put(PUSLAPIO_RAKTAS, kopija);
    }
    return atsakymas;
  } catch (klaida) {
    const issaugotas = await cache.match(PUSLAPIO_RAKTAS, PAIESKA);
    if (issaugotas) return issaugotas;
    throw klaida;
  }
}

/** Failai su maiša varde: jei jau turim — atiduodam iš karto. */
async function failas(request) {
  const cache = await caches.open(CACHE);
  const issaugotas = await cache.match(request, PAIESKA);
  if (issaugotas) return issaugotas;

  const atsakymas = await fetch(request);
  if (atsakymas && atsakymas.ok) {
    await cache.put(request, atsakymas.clone());
    void apkarpyk(cache);
  }
  return atsakymas;
}

/**
 * Žemėlapis: atiduodam iš atminties IŠ KARTO, o naujesnį parsisiunčiam tyliai fone.
 *
 * Šitų failų varduose nėra maišos (`zemelapis/tipai.bin`), tad imti vien iš
 * atminties būtų pavojinga: perpiešus Lietuvą žaidėjas amžinai liktų su senąja.
 * Bet ir laukti tinklo kas kartą negalima — 610 KB kiekvienam atsidarymui.
 * Todėl rodom, ką turim, o kitą kartą jau bus naujesnis.
 */
async function zemelapis(request) {
  const cache = await caches.open(CACHE);
  const issaugotas = await cache.match(request, PAIESKA);
  const siuntimas = fetch(request)
    .then((atsakymas) => {
      if (atsakymas && atsakymas.ok) void cache.put(request, atsakymas.clone());
      return atsakymas;
    })
    .catch(() => null);

  if (issaugotas) {
    void siuntimas;
    return issaugotas;
  }
  const atsakymas = await siuntimas;
  if (atsakymas) return atsakymas;
  // Nėra nei atmintyje, nei tinkle — žaidimas tai atlaiko ir piešia senąjį foną.
  return new Response("", { status: 504 });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Tik savo svetainė. Supabase ir bet kas kitas keliauja tiesiai, be mūsų.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" || url.pathname.endsWith(".html")) {
    event.respondWith(puslapis(request));
    return;
  }

  if (url.pathname.includes("/zemelapis/")) {
    event.respondWith(zemelapis(request));
    return;
  }

  if (url.pathname.includes("/assets/") || /\.(png|jpg|jpeg|webp|svg|woff2?)$/.test(url.pathname)) {
    event.respondWith(failas(request));
  }
});

// Paspaudus pranešimą grįžtam į žaidimą (jei jis kur nors atidarytas).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const langai = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const langas of langai) {
        if ("focus" in langas) return langas.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("./");
    })()
  );
});
