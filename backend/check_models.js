import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

async function checkModels() {
  try {
    const res = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const models = res.data.models
      .filter(m => m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));
    console.log("AVAILABLE MODELS:", models.join(', '));
  } catch (err) {
    console.error("Failed to fetch models:", err.message);
    if (err.response) console.error(err.response.data);
  }
}
checkModels();
