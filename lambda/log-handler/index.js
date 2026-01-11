const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { PutCommand, DynamoDBDocumentClient } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'terminal-site-logs';

// Allowed origins for CORS and security
const ALLOWED_ORIGINS = [
    'https://alfonso.ridao.ar',
    'https://term.ridao.ar',
    'https://win.ridao.ar',
    'https://feature-chat-analytics.dmscxbysbp31y.amplifyapp.com',
    'http://localhost:5182',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'http://localhost:5176',
    'http://localhost:5000'
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

    if (origin && ALLOWED_ORIGINS.includes(origin)) {
        return true;
    }

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
        console.log('Blocked log request from unauthorized origin:', origin);
        return {
            statusCode: 403,
            headers,
            body: JSON.stringify({ error: 'Forbidden: Invalid origin' })
        };
    }

    try {
        const body = JSON.parse(event.body);
        const { type, ip, ...data } = body;

        // Validate log type (terminal-site and win-site events)
        const validTypes = [
            'visit', 'command', 'chat',  // terminal-site
            'win-visit', 'win-click', 'win-window', 'win-chat', 'win-cv', 'win-session'  // win-site
        ];
        if (!type || !validTypes.includes(type)) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Invalid log type' })
            };
        }

        // Create unique partition key with timestamp
        const timestamp = Date.now();
        const pk = `${type}#${timestamp}`;

        // Build the item to store
        const item = {
            pk,
            sk: ip || 'unknown',
            type,
            ip: ip || 'unknown',
            timestamp: new Date().toISOString(),
            ...data
        };

        // Store in DynamoDB
        await docClient.send(new PutCommand({
            TableName: TABLE_NAME,
            Item: item
        }));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ success: true })
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
