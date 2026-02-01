// Vite API endpoint for AI chat
import { askPerplexity } from '../lib/perplexityAPI.cjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { question, areaInfo, conversationHistory } = req.body;
    
    const result = await askPerplexity(question, areaInfo, conversationHistory);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}
