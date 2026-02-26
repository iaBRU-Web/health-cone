module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { messages, model } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // HealthCone system context — injected on every request automatically
    const systemMessage = {
      role: 'system',
      content: [
        'You are HealthCone AI Assistant — a smart, caring health monitoring assistant created by INEZA AIME BRUNO.',
        'HealthCone is an AI-based health monitoring system that:',
        '- Monitors real-time heart rate using wearable smartwatches',
        '- Detects abnormal cardiac activity and sends automatic emergency alerts',
        '- Shares user GPS location with nearby hospitals for fast ambulance response',
        '- Combines traditional wellness wisdom with modern medical science',
        '- Provides tailored health solutions for each user\'s unique wellness journey',
        '- Focuses on early detection of heart problems and continuous health monitoring',
        '',
        'You help users understand their health data, answer wellness questions,',
        'explain HealthCone features, guide emergency procedures, and provide compassionate health advice.',
        'Always make clear that you assist but never replace professional medical doctors.',
        'Respond in a warm, professional, and reassuring tone. Be concise but thorough.',
      ].join('\n')
    };

    // Try each Groq model slot in order until one succeeds
    const modelsToTry = [];
    if (model) modelsToTry.push(model);
    ['groq-1', 'groq-2', 'groq-3', 'groq-4'].forEach(m => {
      if (!modelsToTry.includes(m)) modelsToTry.push(m);
    });

    let lastStatus = 503;
    let lastBody = null;

    for (const m of modelsToTry) {
      let response;
      try {
        response = await fetch('https://health-cone-backend.vercel.app/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [systemMessage, ...messages],
            model: m,
          }),
        });
      } catch (fetchErr) {
        // Network error on this model, try next
        continue;
      }

      if (!response.ok) {
        lastStatus = response.status;
        try { lastBody = await response.json(); } catch (_) {}
        continue;
      }

      // Success — read and normalize the response
      let raw;
      try {
        raw = await response.json();
      } catch (_) {
        continue;
      }

      // Extract the AI reply text from whatever shape bruno-gpt5 returns
      let replyText = '';

      // OpenAI-compatible shape: { choices: [{ message: { content: '...' } }] }
      if (raw.choices && raw.choices.length > 0) {
        replyText = (raw.choices[0].message && raw.choices[0].message.content)
          || raw.choices[0].text
          || '';
      }
      // Direct content field
      else if (typeof raw.content === 'string') {
        replyText = raw.content;
      }
      // Direct message field
      else if (typeof raw.message === 'string') {
        replyText = raw.message;
      }
      // Direct response field
      else if (typeof raw.response === 'string') {
        replyText = raw.response;
      }
      // Direct text field
      else if (typeof raw.text === 'string') {
        replyText = raw.text;
      }
      // Fallback: stringify whatever came back
      else {
        replyText = JSON.stringify(raw);
      }

      if (!replyText) replyText = 'Sorry, I received an empty response. Please try again.';

      // Always return a normalized shape the frontend can rely on
      return res.status(200).json({
        reply: replyText,
        usedModel: m,
      });
    }

    // All models failed
    return res.status(lastStatus || 503).json({
      error: 'HealthCone AI is temporarily unavailable. Please try again in a moment.',
      detail: lastBody || null,
    });

  } catch (error) {
    console.error('HealthCone chat error:', error);
    return res.status(500).json({ error: 'Server error: ' + error.message });
  }
};
