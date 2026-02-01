// Test Perplexity API
const fs = require('fs');
const path = require('path');

// Read .env file
const envPath = path.join(__dirname, '.env');
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

async function testPerplexityAPI() {
  console.log('🔍 Testing Perplexity API...');
  console.log('API Key:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NOT FOUND');

  if (!API_KEY) {
    console.error('❌ PERPLEXITY_API_KEY not found in .env');
    process.exit(1);
  }

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          {
            role: 'user',
            content: 'What is the current average house price in London, UK?'
          }
        ]
      })
    });

    console.log('Response status:', response.status);

    if (!response.ok) {
      const error = await response.text();
      console.error('❌ API Error:', error);
      process.exit(1);
    }

    const data = await response.json();
    console.log('✅ API Response successful!');
    console.log('\n📊 Result:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.choices && data.choices[0]) {
      console.log('\n💬 Answer:');
      console.log(data.choices[0].message.content);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testPerplexityAPI();
