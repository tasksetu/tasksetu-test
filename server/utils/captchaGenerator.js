import crypto from 'crypto';

/**
 * In-memory CAPTCHA challenge store with auto-expiry.
 * Each challenge expires after TTL_MS (5 minutes).
 * Verified challenges are stored separately and expire after VERIFIED_TTL_MS (30 minutes).
 */
const challenges = new Map();       // challengeId -> { answer, expiresAt }
const verifiedTokens = new Map();   // captchaToken -> { expiresAt, token (form external_token) }
const TTL_MS = 5 * 60 * 1000;              // 5 min to solve
const VERIFIED_TTL_MS = 30 * 60 * 1000;    // 30 min validity after solving

// Periodic cleanup every 2 minutes
setInterval(() => {
    const now = Date.now();
    for (const [id, data] of challenges) {
        if (now > data.expiresAt) challenges.delete(id);
    }
    for (const [id, data] of verifiedTokens) {
        if (now > data.expiresAt) verifiedTokens.delete(id);
    }
}, 2 * 60 * 1000);

/**
 * Generate a random math CAPTCHA (e.g., "12 + 7 = ?")
 * Returns { challengeId, svgImage }
 */
export function generateCaptcha(formToken) {
    const num1 = Math.floor(Math.random() * 20) + 1;
    const num2 = Math.floor(Math.random() * 15) + 1;
    const operators = ['+', '-', '×'];
    const opIndex = Math.floor(Math.random() * 3);
    const operator = operators[opIndex];

    let answer;
    switch (operator) {
        case '+': answer = num1 + num2; break;
        case '-': answer = num1 + num2; // make sure result is positive: ask (num1+num2) - num2
            break;
        case '×': answer = num1 * num2; break;
    }

    // For subtraction, ensure positive result
    let displayNum1 = num1;
    let displayNum2 = num2;
    let displayOp = operator;
    if (operator === '-') {
        displayNum1 = num1 + num2;
        displayNum2 = num2;
        answer = num1;
    }

    const text = `${displayNum1} ${displayOp} ${displayNum2} = ?`;
    const challengeId = crypto.randomBytes(16).toString('hex');

    // Store challenge
    challenges.set(challengeId, {
        answer: answer.toString(),
        expiresAt: Date.now() + TTL_MS,
        formToken, // tie to specific form
    });

    // Generate SVG with noise
    const svg = generateSvg(text);

    return { challengeId, svgImage: svg };
}

/**
 * Verify a CAPTCHA answer.
 * Returns { success, captchaToken? } 
 */
export function verifyCaptcha(challengeId, userAnswer, formToken) {
    const challenge = challenges.get(challengeId);

    if (!challenge) {
        return { success: false, message: 'CAPTCHA expired or invalid. Please refresh.' };
    }

    if (Date.now() > challenge.expiresAt) {
        challenges.delete(challengeId);
        return { success: false, message: 'CAPTCHA expired. Please refresh.' };
    }

    if (challenge.formToken !== formToken) {
        return { success: false, message: 'Invalid CAPTCHA request.' };
    }

    const normalizedAnswer = String(userAnswer).trim();
    if (normalizedAnswer !== challenge.answer) {
        return { success: false, message: 'Incorrect answer. Please try again.' };
    }

    // Remove used challenge
    challenges.delete(challengeId);

    // Generate verification token
    const captchaToken = crypto.randomBytes(32).toString('hex');
    verifiedTokens.set(captchaToken, {
        expiresAt: Date.now() + VERIFIED_TTL_MS,
        formToken,
    });

    return { success: true, captchaToken };
}

/**
 * Check if a captcha verification token is valid for a given form token.
 */
export function isCaptchaTokenValid(captchaToken, formToken) {
    if (!captchaToken) return false;

    const data = verifiedTokens.get(captchaToken);
    if (!data) return false;

    if (Date.now() > data.expiresAt) {
        verifiedTokens.delete(captchaToken);
        return false;
    }

    if (data.formToken !== formToken) return false;

    return true;
}

/**
 * Consume (invalidate) a captcha token after form submission.
 */
export function consumeCaptchaToken(captchaToken) {
    verifiedTokens.delete(captchaToken);
}

/**
 * Generate an SVG image of the CAPTCHA text with noise.
 */
function generateSvg(text) {
    const width = 220;
    const height = 70;
    const chars = text.split('');

    // Random color for text
    const textColor = `rgb(${rand(30, 80)}, ${rand(30, 80)}, ${rand(80, 150)})`;

    // Generate noise lines
    let noiseLines = '';
    for (let i = 0; i < 5; i++) {
        const color = `rgb(${rand(100, 200)}, ${rand(100, 200)}, ${rand(100, 200)})`;
        noiseLines += `<line x1="${rand(0, width)}" y1="${rand(0, height)}" x2="${rand(0, width)}" y2="${rand(0, height)}" stroke="${color}" stroke-width="${rand(1, 2)}" />`;
    }

    // Generate noise dots
    let noiseDots = '';
    for (let i = 0; i < 30; i++) {
        const color = `rgb(${rand(100, 200)}, ${rand(100, 200)}, ${rand(100, 200)})`;
        noiseDots += `<circle cx="${rand(0, width)}" cy="${rand(0, height)}" r="${rand(1, 3)}" fill="${color}" />`;
    }

    // Generate characters with slight random positioning and rotation
    let charElements = '';
    const startX = 15;
    const spacing = Math.min(25, (width - 30) / chars.length);

    chars.forEach((char, i) => {
        const x = startX + i * spacing;
        const y = 40 + rand(-8, 8);
        const rotation = rand(-15, 15);
        const fontSize = rand(22, 30);
        charElements += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="monospace, Arial" font-weight="bold" fill="${textColor}" transform="rotate(${rotation} ${x} ${y})">${escapeXml(char)}</text>`;
    });

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="100%" height="100%" fill="#f8f9fa" rx="8" />
    ${noiseLines}
    ${noiseDots}
    ${charElements}
  </svg>`;
}

function rand(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function escapeXml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
