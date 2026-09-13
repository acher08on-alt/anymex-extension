const mangayomiSources = [
  {
    "name": "HentaiMama",
    "lang": "en",
    "baseUrl": "https://hentaimama.io",
    "apiUrl": "",
    "iconUrl": "https://hentaimama.io/wp-content/themes/dooplay/assets/img/mascot-logo.png",
    "typeSource": "single",
    "itemType": 1,
    "isManga": false,
    "isNsfw": true,
    "version": "1.0.2",
    "pkgPath": "hentaimama.js"
  }
];

class DefaultExtension extends MProvider {
  #client;

  get client() {
    return this.#client ??= new Client();
  }

  ensureAbsolute(url) {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("//")) return "https:" + url;
    return "https://hentaimama.io" + (url.startsWith("/") ? "" : "/") + url;
  }

  async getPopular(page) {
    const url = page === 1 
      ? "https://hentaimama.io/hentai-series/" 
      : `https://hentaimama.io/hentai-series/page/${page}/`;

    const res = await this.client.get(url, { "User-Agent": "Mozilla/5.0" });
    const doc = new Document(res.body);
    const elements = doc.select("div.items article.item, article.item.tvshows");

    const list = elements.map((el) => {
      const linkEl = el.selectFirst("div.poster a") || el.selectFirst("a");
      const imgEl = el.selectFirst("div.poster img") || el.selectFirst("img");
      const titleEl = el.selectFirst("div.data h3 a") || el.selectFirst("h3");

      return {
        name: titleEl ? titleEl.text.trim() : (imgEl ? imgEl.attr("alt") : "Unknown"),
        link: this.ensureAbsolute(linkEl ? linkEl.attr("href") : ""),
        imageUrl: this.ensureAbsolute(imgEl ? (imgEl.attr("data-src") || imgEl.attr("src")) : "")
      };
    }).filter(item => item.link.length > 0);

    const hasNextPage = doc.selectFirst("div.pagination a.arrow_pag i.icon-chevron-right") !== null;
    return { list, hasNextPage };
  }

  async getLatestUpdates(page) {
    const url = page === 1 
      ? "https://hentaimama.io/recent-episodes/" 
      : `https://hentaimama.io/recent-episodes/page/${page}/`;

    const res = await this.client.get(url, { "User-Agent": "Mozilla/5.0" });
    const doc = new Document(res.body);
    const elements = doc.select("div.items article.item");

    const list = elements.map((el) => {
      const linkEl = el.selectFirst("div.poster a") || el.selectFirst("a");
      const imgEl = el.selectFirst("div.poster img") || el.selectFirst("img");
      const titleEl = el.selectFirst("div.data h3 a") || el.selectFirst("h3");

      return {
        name: titleEl ? titleEl.text.trim() : (imgEl ? imgEl.attr("alt") : "Unknown"),
        link: this.ensureAbsolute(linkEl ? linkEl.attr("href") : ""),
        imageUrl: this.ensureAbsolute(imgEl ? (imgEl.attr("data-src") || imgEl.attr("src")) : "")
      };
    }).filter(item => item.link.length > 0);

    const hasNextPage = doc.selectFirst("div.pagination a.arrow_pag i.icon-chevron-right") !== null;
    return { list, hasNextPage };
  }

  async search(keyword, page, filters) {
    if (!keyword || keyword.trim().length === 0) {
      return { list: [], hasNextPage: false };
    }

    let searchTerms = [keyword.trim()];
    const words = keyword.trim().split(/\s+/).filter(w => w.length > 3 && !['with','from','that','this'].includes(w.toLowerCase()));
    if (words.length > 1) {
      searchTerms.push(words.slice(0, 3).join(' '));
      searchTerms.push(words[0]);
    }

    let elements = [];
    let doc = null;

    for (const term of searchTerms) {
      const searchUrl = page === 1 
        ? `https://hentaimama.io/?s=${encodeURIComponent(term)}`
        : `https://hentaimama.io/page/${page}/?s=${encodeURIComponent(term)}`;

      try {
        const res = await this.client.get(searchUrl, { "User-Agent": "Mozilla/5.0" });
        doc = new Document(res.body);
        elements = doc.select("div.result-item article, div.items article.item, article.item");
        if (elements.length > 0) break;
      } catch (e) {}
    }

    const list = elements.map((el) => {
      const linkEl = el.selectFirst("div.image a") || el.selectFirst("div.poster a") || el.selectFirst("a");
      const imgEl = el.selectFirst("div.image img") || el.selectFirst("div.poster img") || el.selectFirst("img");
      const titleEl = el.selectFirst("div.title a") || el.selectFirst("div.data h3 a") || el.selectFirst("h3");

      return {
        name: titleEl ? titleEl.text.trim() : (imgEl ? imgEl.attr("alt") : "Unknown"),
        link: this.ensureAbsolute(linkEl ? linkEl.attr("href") : ""),
        imageUrl: this.ensureAbsolute(imgEl ? (imgEl.attr("data-src") || imgEl.attr("src")) : "")
      };
    }).filter(item => item.link.length > 0);

    const hasNextPage = doc ? doc.selectFirst("div.pagination a.arrow_pag i.icon-chevron-right") !== null : false;
    return { list, hasNextPage };
  }

  async getDetail(url) {
    if (!url || url.trim().length === 0) {
      return { description: "", status: 5, genre: [], episodes: [] };
    }

    let targetUrl = this.ensureAbsolute(url.trim());

    if (targetUrl.includes("/episodes/")) {
      try {
        const tempRes = await this.client.get(targetUrl, { "User-Agent": "Mozilla/5.0" });
        const tempDoc = new Document(tempRes.body);
        const parentLink = tempDoc.selectFirst("a[href*='/tvshows/']");
        if (parentLink && parentLink.attr("href")) {
          targetUrl = this.ensureAbsolute(parentLink.attr("href"));
        }
      } catch (e) {}
    }

    const res = await this.client.get(targetUrl, { "User-Agent": "Mozilla/5.0" });
    const doc = new Document(res.body);

    const title = doc.selectFirst("div.sheader h1, h1")?.text?.trim() ?? "Unknown";
    const imgEl = doc.selectFirst("div.poster img");
    const imageUrl = this.ensureAbsolute(imgEl ? (imgEl.attr("data-src") || imgEl.attr("src")) : "");
    const description = doc.selectFirst("div.wp-content p, #info p, div.sinopsis")?.text?.trim() ?? "";
    const genres = doc.select("div.sgenres a").map(a => a.text.trim());

    let episodeRows = doc.select("ul.episodios li, div.episodios li");
    if (episodeRows.length === 0) {
      episodeRows = doc.select("a[href*='/episodes/']");
    }

    const episodes = [];
    episodeRows.forEach((row, idx) => {
      const epLink = row.tagName === 'a' ? row : (row.selectFirst("div.episodiotitle a") || row.selectFirst("a"));
      const epTitle = epLink?.text?.trim() || `Episode ${idx + 1}`;

      if (epLink && epLink.attr("href")) {
        episodes.push({
          name: epTitle.replace(/\s+/g, ' ').trim(),
          url: this.ensureAbsolute(epLink.attr("href"))
        });
      }
    });

    return {
      name: title,
      imageUrl: imageUrl,
      description: description,
      genre: genres,
      status: 1,
      episodes: episodes
    };
  }

  async getVideoList(episodeUrl) {
    const targetUrl = this.ensureAbsolute(episodeUrl);
    const res = await this.client.get(targetUrl, { 
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      "Referer": "https://hentaimama.io/"
    });
    
    let postId = null;
    const postIdMatch = res.body.match(/a:\s*'(\d+)'/) || res.body.match(/data-post="(\d+)"/);
    if (postIdMatch) {
      postId = postIdMatch[1];
    }

    const videos = [];

    if (postId) {
      try {
        const ajaxUrl = "https://hentaimama.io/wp-admin/admin-ajax.php";
        const ajaxRes = await this.client.post(
          ajaxUrl,
          {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "Referer": targetUrl,
            "X-Requested-With": "XMLHttpRequest",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
          },
          `action=get_player_contents&a=${postId}`
        );

        const mirrorRegex = /(?:src|href)=["']([^"']*(?:new\d\.php\?p=|embed)[^"']*)["']/g;
        let match;
        let mirrorIndex = 1;

        while ((match = mirrorRegex.exec(ajaxRes.body)) !== null) {
          let mirrorUrl = match[1].replace(/\\/g, '');
          if (mirrorUrl.startsWith("//")) mirrorUrl = "https:" + mirrorUrl;

          try {
            const mirrorRes = await this.client.get(mirrorUrl, { 
              "Referer": targetUrl,
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            });

            const streamMatch = mirrorRes.body.match(/(https?:\/\/[^"']+\.(?:m3u8|mp4)[^"']*)/i) 
              || mirrorRes.body.match(/source\s*src=["']([^"']+)["']/i);

            if (streamMatch) {
              videos.push({
                url: streamMatch[1],
                originalUrl: targetUrl,
                quality: `Mirror ${mirrorIndex}`,
                headers: {
                  "Referer": mirrorUrl,
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
                }
              });
              mirrorIndex++;
            }
          } catch (e) {}
        }
      } catch (e) {}
    }

    if (videos.length === 0) {
      const doc = new Document(res.body);
      const iframes = doc.select("iframe");
      for (const iframe of iframes) {
        const src = iframe.attr("src");
        if (src && !src.includes("juicyads") && !src.includes("google")) {
          videos.push({
            url: this.ensureAbsolute(src),
            originalUrl: targetUrl,
            quality: "Web Embed",
            headers: { "Referer": targetUrl }
          });
        }
      }
    }

    return videos;
  }
      }
