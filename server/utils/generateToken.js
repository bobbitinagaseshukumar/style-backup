const jwt = require('jsonwebtoken');

const generateToken = (userId, role, tokenVersion = 0) => {
    const secret = process.env.JWT_SECRET || 'styleverse_super_secret_jwt_key_2026';
    return jwt.sign({ id: userId, role, tokenVersion }, secret, {
        expiresIn: process.env.JWT_EXPIRES_IN || '365d',
    });
};

const sendTokenResponse = (user, statusCode, res, message="Token generated successfully") => {
    const token = generateToken(user.id, user.role, user.tokenVersion || 0);

    const days = parseInt(process.env.JWT_COOKIE_EXPIRES_IN || '30', 10);
    const options = {
        expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    };

    user.password = undefined;

    res.status(statusCode).cookie('token', token, options).json({
        success: true,
        message,
        data: { user, token }
    });
};

module.exports = { generateToken, sendTokenResponse };
