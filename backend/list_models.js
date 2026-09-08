import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("No API key found in .env");
    
    const response = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    console.log("AVAILABLE MODELS:");
    response.data.models.forEach(m => {
      if (m.supportedGenerationMethods.includes('generateContent') && m.name.includes('gemini')) {
        console.log(`- ${m.name}`);
      }
    });
  } catch (err) {
    console.error(err.response?.data || err.message);
  }
}
run();
