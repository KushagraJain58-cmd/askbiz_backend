const crypto = require('crypto');

const config = {
    algorithm : 'aes-256-cbc',
    key: crypto.createHash('sha256').update(String("random_key")).digest('base64').substr(0, 32), // Hash and truncate to 32 bytes
    iv: crypto.createHash('md5').update(String("random_iv")).digest('base64').substr(0, 16) // Hash and truncate to 16 bytes
}

function encrypt(text) {
    let cipher = crypto.createCipheriv(config.algorithm, config.key, config.iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return encrypted;
}

function decrypt(encryptedText) {
    let decipher = crypto.createDecipheriv(config.algorithm, config.key, config.iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

module.exports = {
    encrypt,
    decrypt,
    config
}