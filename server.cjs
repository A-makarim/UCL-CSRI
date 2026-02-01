// Simple Express server for AI API
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const { askPerplexity } = require('./src/lib/perplexityAPI.cjs');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://ucl-csri-frontend.onrender.com', 'https://ucl-csri.onrender.com']
    : '*',
  credentials: true
}));
app.use(express.json());

// Health check endpoint for Render
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'UCL-CSRI API Server Running' });
});

// Scrape images from Zoopla listing
app.post('/api/scrape-images', async (req, res) => {
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

    // Fetch the page (direct)
    let html = await fetchHtml(url);
    let $ = cheerio.load(html);
    
    // Extract images from Zoopla's photo gallery
    const imageUrls = [];
    
    // Zoopla stores images in various places, try multiple selectors
    // Look for ANY image on the page (more aggressive approach)
    $('img, picture source').each((i, el) => {
      const src = $(el).attr('src') || $(el).attr('data-src') || $(el).attr('srcset') || $(el).attr('data-lazy');
      if (src && !src.includes('logo') && !src.includes('icon') && !src.includes('avatar') && !src.includes('placeholder')) {
        // Get highest quality version
        let cleanUrl = src.split(',')[0].split(' ')[0];
        // Replace size parameters to get high-res version if it's a Zoopla image
        if (cleanUrl.includes('zoopla')) {
          cleanUrl = cleanUrl.replace(/\/\d+x\d+\//, '/1024x768/');
        }
        if (!imageUrls.includes(cleanUrl) && cleanUrl.startsWith('http')) {
          imageUrls.push(cleanUrl);
        }
      }
    });
    
    // Also look for data attributes commonly used for lazy loading
    $('[data-srcset], [data-lazy-src]').each((i, el) => {
      const src = $(el).attr('data-srcset') || $(el).attr('data-lazy-src');
      if (src && !src.includes('logo')) {
        const cleanUrl = src.split(',')[0].split(' ')[0];
        if (cleanUrl.startsWith('http') && !imageUrls.includes(cleanUrl)) {
          imageUrls.push(cleanUrl);
        }
      }
    });
    
    console.log(`🔍 Found ${imageUrls.length} image URLs from img tags`);
    
    // Also check for Open Graph / meta images
    $('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').each((i, el) => {
      const content = $(el).attr('content');
      if (content && content.startsWith('http') && !imageUrls.includes(content)) {
        imageUrls.push(content);
      }
    });

    // Also check for JSON-LD structured data
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

    // If no images found, try Jina AI proxy to bypass protections
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
    
    // Download images and convert to base64
    const base64Images = [];
    const maxImages = Math.min(imageUrls.length, 8); // Limit to 8 images
    
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
});

app.post('/api/ask-ai', async (req, res) => {
  try {
    const { question, areaInfo, conversationHistory } = req.body;
    
    console.log('📨 AI Request:', question.substring(0, 100) + '...');
    
    const result = await askPerplexity(question, areaInfo, conversationHistory);
    
    console.log('✅ AI Response sent');
    res.json(result);
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send email quote
app.post('/api/send-quote', async (req, res) => {
  try {
    const { propertyInfo, sellerEmail, aiResponse, userQuestion, offerPrice } = req.body;
    
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      return res.status(500).json({ 
        error: 'Email service not configured. Please add GMAIL_USER and GMAIL_APP_PASSWORD to .env file.' 
      });
    }
    
    const nodemailer = require('nodemailer');
    
    console.log('📧 Sending AI-generated quote email for:', propertyInfo.name);
    if (offerPrice) {
      console.log('💰 Offer amount:', '£' + offerPrice.toLocaleString());
    }
    
    // Create transporter using Gmail
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
      }
    });
    
    // Parse CC emails from environment variable (comma-separated)
    const ccEmails = process.env.CC_EMAILS ? process.env.CC_EMAILS.split(',').map(e => e.trim()).filter(e => e) : [];
    
    // Email content with AI insights
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: sellerEmail || process.env.DEFAULT_SELLER_EMAIL || 'property-inquiry@example.com',
      cc: ccEmails.length > 0 ? ccEmails : undefined,
      subject: `Property Inquiry${offerPrice ? ' & Offer' : ''}: ${propertyInfo.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #00F3FF;">Property Inquiry${offerPrice ? ' & Offer' : ''}</h2>
          
          <p>Hello,</p>
          
          <p>I am interested in the property listed below and would like to ${offerPrice ? 'make an offer and ' : ''}schedule a viewing:</p>
          
          <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Property Details</h3>
            <p><strong>Address:</strong> ${propertyInfo.name}</p>
            <p><strong>Listed Price:</strong> £${propertyInfo.price?.toLocaleString()}</p>
            ${offerPrice ? `<p style="color: #00A000; font-size: 18px;"><strong>My Offer:</strong> £${offerPrice.toLocaleString()}</p>` : ''}
            ${propertyInfo.bedrooms ? `<p><strong>Bedrooms:</strong> ${propertyInfo.bedrooms}</p>` : ''}
            ${propertyInfo.bathrooms ? `<p><strong>Bathrooms:</strong> ${propertyInfo.bathrooms}</p>` : ''}
            ${propertyInfo.propertySize ? `<p><strong>Size:</strong> ${propertyInfo.propertySize} ${propertyInfo.sizeMetric}</p>` : ''}
            ${propertyInfo.listingUrl ? `<p><strong>Listing:</strong> <a href="${propertyInfo.listingUrl}" style="color: #00F3FF;">View Property</a></p>` : ''}
          </div>
          
          ${aiResponse ? `
          <div style="background: #f0f9ff; border-left: 4px solid #00F3FF; padding: 15px; margin: 20px 0;">
            <h4 style="margin-top: 0; color: #00A0C0;">Market Analysis Summary</h4>
            <p style="font-size: 14px; line-height: 1.6; color: #333;">${aiResponse.substring(0, 500)}${aiResponse.length > 500 ? '...' : ''}</p>
          </div>
          ` : ''}
          
          <p>I would appreciate it if you could provide:</p>
          <ul>
            <li>Available viewing times</li>
            <li>Additional property details or documents</li>
            <li>Information about the area and local amenities</li>
            ${offerPrice ? '<li>Your response to my offer</li>' : ''}
          </ul>
          
          <p>I look forward to hearing from you soon.</p>
          
          <p>Best regards</p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
          <p style="font-size: 12px; color: #888;">
            This email was sent via UCL-CSRI AI Property Platform with market insights
          </p>
        </div>
      `
    };
    
    // Send email
    await transporter.sendMail(mailOptions);
    
    console.log('✅ AI-generated quote email sent successfully');
    res.json({ success: true, message: 'Quote sent successfully!' });
    
  } catch (error) {
    console.error('❌ Email Error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`🤖 AI API server running on http://localhost:${PORT}`);
});
