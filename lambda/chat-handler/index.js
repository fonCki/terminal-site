const { GoogleGenerativeAI } = require('@google/generative-ai');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');

// S3 config for persona file (stored privately, not in GitHub)
const S3_BUCKET = process.env.PERSONA_BUCKET || 'terminal-site-private';
const S3_KEY = process.env.PERSONA_KEY || 'persona.txt';

// Initialize clients
const s3Client = new S3Client({});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Cache persona after first load
let cachedPersona = null;
let cachedModel = null;

async function getPersona() {
    if (cachedPersona) return cachedPersona;

    try {
        const command = new GetObjectCommand({
            Bucket: S3_BUCKET,
            Key: S3_KEY
        });
        const response = await s3Client.send(command);
        cachedPersona = await response.Body.transformToString();
        return cachedPersona;
    } catch (error) {
        console.error('Error fetching persona from S3:', error);
        throw new Error('Failed to load persona');
    }
}

async function getModel() {
    if (cachedModel) return cachedModel;

    const persona = await getPersona();
    cachedModel = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: {
            role: 'user',
            parts: [{ text: persona }]
        }
    });
    return cachedModel;
}

// Allowed origins for CORS and security
const ALLOWED_ORIGINS = [
    'https://alfonso.ridao.ar',
    'https://term.ridao.ar',
    'https://feature-chat-analytics.dmscxbysbp31y.amplifyapp.com',
    'http://localhost:5182',  // Local development
    'http://localhost:5000'   // Local development alternative
];

// Get CORS headers with proper origin
function getCorsHeaders(origin) {
    const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
    return {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
}

// Validate origin from request
function isAllowedOrigin(event) {
    const origin = event.headers?.origin || event.headers?.Origin || '';
    const referer = event.headers?.referer || event.headers?.Referer || '';

    // Check origin header
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        return true;
    }

    // Check referer as fallback (extract origin from full URL)
    if (referer) {
        for (const allowed of ALLOWED_ORIGINS) {
            if (referer.startsWith(allowed)) {
                return true;
            }
        }
    }

    return false;
}

exports.handler = async (event) => {
    const origin = event.headers?.origin || event.headers?.Origin || ALLOWED_ORIGINS[0];
    const headers = getCorsHeaders(origin);

    // Handle CORS preflight
    if (event.httpMethod === 'OPTIONS' || event.requestContext?.http?.method === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Security: Validate origin
    if (!isAllowedOrigin(event)) {
        const debugOrigin = event.headers?.origin || event.headers?.Origin || 'no-origin';
        const debugReferer = event.headers?.referer || event.headers?.Referer || 'no-referer';
        console.log('Blocked request - origin:', debugOrigin, 'referer:', debugReferer, 'allowed:', ALLOWED_ORIGINS);
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Forbidden: Invalid origin' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const userMessage = body.message;
        const history = body.history || [];

        // DEBUG: Log what we receive
        console.log('CHAT DEBUG - Received history:', JSON.stringify(history));
        console.log('CHAT DEBUG - History length:', history.length);
        console.log('CHAT DEBUG - Message:', userMessage);

        // Validate input
        if (!userMessage || typeof userMessage !== 'string') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid message' })
            };
        }

        // Limit message length
        if (userMessage.length > 1000) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Message too long (max 1000 characters)' })
            };
        }

        // Get model (loads persona from S3 on first call)
        const model = await getModel();

        // Build conversation history for Gemini (filter out empty messages)
        // Support both camelCase (content/role) and PascalCase (Content/Role) for compatibility
        const geminiHistory = history
            .filter(msg => (msg.content || msg.Content) && (msg.content || msg.Content).trim().length > 0)
            .map(msg => ({
                role: (msg.role || msg.Role) === 'assistant' ? 'model' : 'user',
                parts: [{ text: msg.content || msg.Content }]
            }));

        // Start chat with conversation history
        const chat = model.startChat({
            history: geminiHistory,
            generationConfig: {
                maxOutputTokens: 2048,
                temperature: 0.7
            }
        });

        // Send message and get response
        const result = await chat.sendMessage(userMessage);
        const responseText = result.response.text();

        // Debug: log response details
        console.log('Gemini response candidates:', JSON.stringify(result.response.candidates));
        console.log('Response text length:', responseText.length);
        console.log('Finish reason:', result.response.candidates?.[0]?.finishReason);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ response: responseText })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};
