const crypto = require('crypto');

// Password hash (SHA-256 of the password) - stored securely
const PASSWORD_HASH = process.env.PASSWORD_HASH;
// Secret key for signing tokens - stored in env vars
const TOKEN_SECRET = process.env.TOKEN_SECRET;
// Token validity in hours
const TOKEN_VALIDITY_HOURS = 24;

const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
};

function hashPassword(password) {
    return crypto.createHash('sha256').update(password).digest('hex');
}

function generateToken() {
    const payload = {
        exp: Date.now() + (TOKEN_VALIDITY_HOURS * 60 * 60 * 1000),
        iat: Date.now(),
        type: 'analytics_access'
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(payloadBase64)
        .digest('base64url');

    return `${payloadBase64}.${signature}`;
}

function verifyToken(token) {
    if (!token) return { valid: false, error: 'No token provided' };

    const parts = token.split('.');
    if (parts.length !== 2) return { valid: false, error: 'Invalid token format' };

    const [payloadBase64, signature] = parts;

    // Verify signature
    const expectedSignature = crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(payloadBase64)
        .digest('base64url');

    if (signature !== expectedSignature) {
        return { valid: false, error: 'Invalid signature' };
    }

    // Decode and check expiration
    try {
        const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString());
        if (Date.now() > payload.exp) {
            return { valid: false, error: 'Token expired' };
        }
        return { valid: true, payload };
    } catch {
        return { valid: false, error: 'Invalid payload' };
    }
}

exports.handler = async (event) => {
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath || '';

    // Handle CORS preflight
    if (httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    // Login endpoint
    if (path.includes('/login') && httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { password } = body;

            if (!password) {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({ error: 'Password required' })
                };
            }

            const passwordHash = hashPassword(password);

            if (passwordHash !== PASSWORD_HASH) {
                // Add small delay to prevent brute force
                await new Promise(r => setTimeout(r, 1000));
                return {
                    statusCode: 401,
                    headers,
                    body: JSON.stringify({ error: 'Invalid password' })
                };
            }

            const token = generateToken();

            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    token,
                    expiresIn: TOKEN_VALIDITY_HOURS * 60 * 60 * 1000
                })
            };
        } catch (error) {
            console.error('Login error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Internal server error' })
            };
        }
    }

    // Verify endpoint (for other Lambdas to validate tokens)
    if (path.includes('/verify') && httpMethod === 'POST') {
        try {
            const body = JSON.parse(event.body || '{}');
            const { token } = body;

            const result = verifyToken(token);

            return {
                statusCode: result.valid ? 200 : 401,
                headers,
                body: JSON.stringify(result)
            };
        } catch (error) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'Internal server error' })
            };
        }
    }

    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Not found' })
    };
};

// Export for use by other Lambdas
exports.verifyToken = verifyToken;
