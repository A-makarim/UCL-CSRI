// Perplexity AI API integration
const fetch = require('node-fetch');

const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

if (!PERPLEXITY_API_KEY) {
  console.warn('⚠️  PERPLEXITY_API_KEY environment variable is not set. AI features will not work.');
}

async function askPerplexity(query, areaInfo = {}, conversationHistory = []) {
  if (!PERPLEXITY_API_KEY) {
    throw new Error('PERPLEXITY_API_KEY environment variable is not configured');
  }
  try {
    // Build messages array with conversation history
    const messages = [
      {
        role: 'system',
        content: 'You are a helpful UK real estate analyst. Provide concise, accurate insights about properties and the London market. Use markdown formatting. When relevant, include direct image URLs or markdown image links if available.'
      },
      ...conversationHistory,
      {
        role: 'user',
        content: query
      }
    ];

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: messages,
        temperature: 0.2,
        max_tokens: 800
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Perplexity API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const answer = data.choices[0].message.content;

    // Return response in expected format with answer and optional citations
    return {
      answer: answer,
      citations: data.citations || [],
      sources: []
    };
  } catch (error) {
    console.error('❌ Perplexity API error:', error.message);
    throw error;
  }
}

module.exports = { askPerplexity };