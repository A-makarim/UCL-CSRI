// Vercel serverless function for AI chat
const fetch = require('node-fetch');

// Perplexity API function
async function askPerplexity(question, areaInfo, conversationHistory = []) {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  
  if (!apiKey) {
    throw new Error('PERPLEXITY_API_KEY not configured');
  }

  const messages = [
    {
      role: 'system',
      content: `You are an expert UK real estate analyst with deep knowledge of property markets, investment strategies, and environmental sustainability. Provide accurate, data-driven insights about UK property markets. Focus on London and surrounding areas. Always cite current market data when available.`
    }
  ];

  // Add conversation history
  if (conversationHistory && conversationHistory.length > 0) {
    messages.push(...conversationHistory);
  }

  // Add the new question
  messages.push({
    role: 'user',
    content: question
  });

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: messages,
        temperature: 0.2,
        top_p: 0.9,
        return_citations: true,
        search_domain_filter: ['zoopla.co.uk', 'rightmove.co.uk', 'ons.gov.uk', 'landregistry.gov.uk'],
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'month',
        top_k: 0,
        stream: false,
        presence_penalty: 0,
        frequency_penalty: 1
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Perplexity API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      citations: data.citations || []
    };
  } catch (error) {
    console.error('Perplexity API Error:', error);
    throw error;
  }
}

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
    const { question, areaInfo, conversationHistory } = req.body;
    
    console.log('📨 AI Request:', question.substring(0, 100) + '...');
    
    const result = await askPerplexity(question, areaInfo, conversationHistory);
    
    console.log('✅ AI Response sent');
    res.json(result);
  } catch (error) {
    console.error('❌ API Error:', error);
    res.status(500).json({ error: error.message });
  }
};
