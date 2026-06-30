const generateSalt = ()=>{
    return new Date().getMilliseconds()%14;
}

module.exports = generateSalt;