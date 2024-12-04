const axios = require('axios');
const config = require('../config/config');
const { AIError } = require('../utils/errors');

class AIService {
    constructor() {
        this.baseURL = 'https://api-inference.huggingface.co/models/Qwen/Qwen2.5-72B-Instruct';
        this.headers = {
            'Authorization': `Bearer ${config.ai.apiKey}`,
            'Content-Type': 'application/json'
        };
    }

    // Format prompt for Qwen
    formatPrompt(query, isThankYou = false) {
        if (isThankYou) {
            return `<|im_start|>system
You are a friendly WhatsApp bot. Someone is thanking you. Respond warmly but briefly.
<|im_end|>
<|im_start|>user
${query}
<|im_end|>
<|im_start|>assistant`;
        }

        return `<|im_start|>system
You are a helpful WhatsApp bot assistant. Provide concise, accurate responses.
<|im_end|>
<|im_start|>user
${query}
<|im_end|>
<|im_start|>assistant`;
    }

    // Check if message is a thank you
    isThankYouMessage(message) {
        if (!message) return false;
        
        const thankYouPatterns = [
            /thank(?:s| you)/i,
            /thx/i,
            /tysm/i,
            /grateful/i,
            /appreciate/i
        ];
        return thankYouPatterns.some(pattern => pattern.test(message));
    }

    // Generate AI response
    async generateResponse(query) {
        try {
            const isThankYou = this.isThankYouMessage(query);
            const prompt = this.formatPrompt(query, isThankYou);

            const response = await axios.post(this.baseURL, {
                inputs: prompt,
                parameters: {
                    max_new_tokens: config.ai.maxTokens,
                    temperature: config.ai.temperature,
                    top_p: 0.7,
                    do_sample: true,
                    return_full_text: false
                }
            }, {
                headers: this.headers,
                timeout: 30000 // 30 seconds timeout
            });

            if (!response.data || !Array.isArray(response.data) || !response.data[0]) {
                throw new AIError('Invalid response from AI service');
            }

            // Extract the response text
            let aiResponse = response.data[0].generated_text || '';
            
            // Clean up the response
            aiResponse = aiResponse
                .replace(/<\|im_end\|>/g, '')
                .replace(/<\|im_start\|>assistant/g, '')
                .trim();

            return aiResponse || 'I apologize, but I could not generate a proper response.';

        } catch (error) {
            console.error('AI Error:', error.response?.data || error.message);
            
            if (error.response) {
                // API error response
                const message = error.response.data?.error || 'AI service error';
                throw new AIError(message);
            } else if (error.request) {
                // No response received
                throw new AIError('No response from AI service');
            } else {
                // Request setup error
                throw new AIError(error.message);
            }
        }
    }

    // Process query with retry mechanism
    async processQuery(query, maxRetries = 2) {
        let lastError;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const response = await this.generateResponse(query);
                return response;
            } catch (error) {
                console.error(`Attempt ${attempt + 1} failed:`, error.message);
                lastError = error;
                if (attempt < maxRetries) {
                    // Wait before retrying (exponential backoff)
                    await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                    continue;
                }
            }
        }

        // If all retries failed, return a fallback message
        console.error('All retry attempts failed:', lastError.message);
        return "I apologize, but I'm having trouble processing your request right now. Please try again later.";
    }

    // Generate birthday wish
    async generateBirthdayWish(name) {
        const prompt = `Generate a warm, personalized birthday wish for ${name}. Keep it concise but heartfelt.`;
        try {
            const response = await this.processQuery(prompt);
            return response;
        } catch (error) {
            console.error('Error generating birthday wish:', error);
            // Return a default wish if AI fails
            return `🎉 Happy Birthday ${name}! 🎂 Wishing you a fantastic day filled with joy and happiness! 🎈✨`;
        }
    }
}

module.exports = new AIService();
