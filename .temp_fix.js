const fs = require('fs');
let content = fs.readFileSync('src/auth/controllers/AuthController.ts', 'utf8');

content = content.replace(/email: cleanEmail \|\| undefined, mobile: cleanMobile \|\| undefined/g, function(match, offset, str) {
  if (str.substring(offset - 400, offset).includes('cleanEmail =')) {
    return 'email: cleanEmail || undefined';
  }
  if (str.substring(offset - 400, offset).includes('cleanMobile =')) {
    return 'mobile: cleanMobile || undefined';
  }
  return match;
});

fs.writeFileSync('src/auth/controllers/AuthController.ts', content);
