var generateRandomPassword = function(length) {
  if (length === undefined) length = 8; // Default length is 8

  var lowercase = 'abcdefghijklmnopqrstuvwxyz';
  var uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var numbers = '0123456789';
  var symbols = '@';

  var password = '';
  var allChars = lowercase + uppercase + numbers + symbols;

  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += symbols[Math.floor(Math.random() * symbols.length)];

  for (var i = 4; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
  }

  password = password.split('').sort(function() {
      return Math.random() - 0.5;
  }).join('');

  // console.log("|--:Password:--|::>>", password);
  return password;
};

module.exports = generateRandomPassword;
