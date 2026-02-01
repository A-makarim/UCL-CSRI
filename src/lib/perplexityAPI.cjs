// Perplexity AI API handler
const fs = require('fs');
const path = require('path');

// Read API key from .env (in project root, two levels up from src/lib)
const envPath = path.join(__dirname, '../../.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1].trim()] = match[2].trim();
  }
});

const API_KEY = envVars.PERPLEXITY_API_KEY;
const API_URL = 'https://api.perplexity.ai/chat/completions';

async function askPerplexity(question, areaInfo, conversationHistory = []) {
  if (!API_KEY) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  // Build conversation context
  const messages = [
    {
      role: 'system',
      content: `You are a UK real estate market expert. Provide accurate, data-driven insights about property markets, prices, trends, and investment potential.

IMPORTANT FORMATTING RULES:
• Use plain text bullet points with • symbol (no markdown ** or __)
• Keep each point brief and informative (1-2 lines max)
• Use simple section labels followed by colon (e.g., "Historical Trends:" not "**Historical Trends**")
• NO bold, italics, or other markdown formatting
• Always cite sources and specify timeframes

WHEN LISTING URL IS PROVIDED:
• Use web search to fetch details from the actual property listing page
• Compare the property price with similar properties in that area
• Check recent sales data for comparable properties nearby
• Assess if the asking price is competitive, overpriced, or underpriced
• Provide specific negotiation advice with suggested offer ranges
• Include market timing recommendations (buy now vs wait)
• Note any property-specific features or concerns from the listing
• Consider future price trends for that specific area

WHEN USER ASKS FOR PICTURES/IMAGES/PHOTOS:
• Property portal images are often behind authentication and can't be directly embedded
• Instead, return listing page URLs where images can be viewed in format: [LISTING: url]
• Search multiple portals: Zoopla, Rightmove, OnTheMarket, Hamptons, Foxtons
• Return 3-5 listing URLs that have photo galleries for this property or building
• Format each as: [LISTING: https://www.zoopla.co.uk/...] with brief description
• Example response:
  I found several listings with photo galleries:
  [LISTING: https://www.zoopla.co.uk/for-sale/details/12345] - Original listing with 15 photos
  [LISTING: https://www.rightmove.co.uk/properties/98765] - Similar unit with 12 interior shots
  [LISTING: https://www.onthemarket.com/details/xyz] - Comparable property in same building
• Each listing link will open in a new tab where you can view all property images
• Prioritize listings with the most photos and best quality images

Example format:
Historical Trends:
• Prices increased 15% from 2020-2025 in this area
• Peak growth was in 2021-2022 period

Current Market:
• Average house price is £X
• Sales volume has Y trend

For live listings with URLs:
• Be specific and actionable with buyer advice
• Reference actual comparable sales with dates and prices
• Give clear negotiation strategy with number ranges`
    },
    ...conversationHistory,
    {
      role: 'user',
      content: question
    }
  ];

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: messages,
        temperature: 0.2,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Perplexity API error: ${error}`);
    }

    const data = await response.json();
    
    return {
      answer: data.choices[0].message.content,
      citations: data.citations || [],
      sources: data.search_results || [],
      usage: data.usage
    };
  } catch (error) {
    console.error('Perplexity API Error:', error);
    throw error;
  }
}

module.exports = { askPerplexity };
