// Vercel serverless function for image scraping
const fetch = require('node-fetch');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }
    
    console.log('🖼️  Scraping images from:', url);
    
    const fetchHtml = async (targetUrl) => {
      console.log('📡 Fetching:', targetUrl);
      const response = await fetch(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      return response.text();
    };

    let html = await fetchHtml(url);
    let $ = cheerio.load(html);
    
    const imageUrls = [];
    
    $('img, picture source').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset') || $(el).attr('data-lazy');
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar') && !src.includes('placeholder')) {
        let cleanUrl = src.split(',')[0].split(' ')[0];
        if (cleanUrl.includes('zoopla')) {
          cleanUrl = cleanUrl.replace(/\/\d+x\d+\//, '/1024x768/');
        }
        if (!imageUrls.includes(cleanUrl) && cleanUrl.startsWith('http')) {
          imageUrls.push(cleanUrl);
        }
      }
    });
    
    $('[data-srcset], [data-lazy-src]').each((i, el) => {
      const src = $(el).attr('data-srcset') || $(el).attr('data-lazy-src');
      if (src && !src.includes('logo')) {
        const cleanUrl = src.split(',')[0].split(' ')[0];
        if (cleanUrl.startsWith('http') && !imageUrls.includes(cleanUrl)) {
          imageUrls.push(cleanUrl);
        }
      }
    });
    
    console.log(`🔍 Found ${imageUrls.length} image URLs`);
    
    $('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').each((i, el) => {
      const content = $(el).attr('content');
      if (content && content.startsWith('http') && !imageUrls.includes(content)) {
        imageUrls.push(content);
      }
    });

    $('script[type="application/ld+json"]').each((i, el) => {
      try {
        const json = JSON.parse($(el).html());
        if (json.image) {
          const imgs = Array.isArray(json.image) ? json.image : [json.image];
          imgs.forEach(img => {
            const imgUrl = typeof img === 'string' ? img : img.url;
            if (imgUrl && !imageUrls.includes(imgUrl)) {
              imageUrls.push(imgUrl);
            }
          });
        }
      } catch (e) {}
    });

    if (imageUrls.length === 0) {
      try {
        const proxyUrl = `https://r.jina.ai/http://` + url.replace(/^https?:\/\//, '');
        const proxyHtml = await fetchHtml(proxyUrl);
        const $$ = cheerio.load(proxyHtml);

        $$('img[src], img[data-src], picture source[srcset]').each((i, el) => {
          const src = $$(el).attr('src') || $$(el).attr('data-src') || $$(el).attr('srcset');
          if (src && !src.includes('logo') && !src.includes('icon')) {
            const cleanUrl = src.split(',')[0].split(' ')[0];
            if (cleanUrl.startsWith('http') && !imageUrls.includes(cleanUrl)) {
              imageUrls.push(cleanUrl);
            }
          }
        });

        $$('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').each((i, el) => {
          const content = $$(el).attr('content');
          if (content && content.startsWith('http') && !imageUrls.includes(content)) {
            imageUrls.push(content);
          }
        });
      } catch (proxyErr) {
        console.log('⚠️  Proxy fetch failed:', proxyErr.message);
      }
    }
    
    console.log(`📥 Downloading ${Math.min(imageUrls.length, 8)} images...`);
    
    const base64Images = [];
    const maxImages = Math.min(imageUrls.length, 8);
    
    for (let i = 0; i < maxImages; i++) {
      try {
        const imgResponse = await fetch(imageUrls[i], {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (imgResponse.ok) {
          const buffer = await imgResponse.buffer();
          const contentType = imgResponse.headers.get('content-type') || 'image/jpeg';
          const base64 = buffer.toString('base64');
          base64Images.push(`data:${contentType};base64,${base64}`);
          console.log(`✅ Downloaded image ${i + 1}/${maxImages}`);
        }
      } catch (err) {
        console.log(`⚠️  Failed to download image ${i + 1}`);
      }
    }
    
    console.log(`✅ Successfully downloaded ${base64Images.length} images`);
    res.json({ images: base64Images });
    
  } catch (error) {
    console.error('❌ Scrape Error:', error);
    res.status(500).json({ error: error.message });
  }
};
