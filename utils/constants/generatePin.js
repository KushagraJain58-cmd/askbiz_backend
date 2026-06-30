const generatePin = () => {
    const pin = Math.floor(100000 + Math.random() * 900000);
    return pin;
};

module.exports = generatePin;