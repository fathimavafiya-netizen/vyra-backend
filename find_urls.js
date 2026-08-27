const fs = require('fs');
const readline = require('readline');

async function processLineByLine() {
  const fileStream = fs.createReadStream('C:\\Users\\HP\\.gemini\\antigravity-ide\\brain\\a76b5b89-fd6e-4d32-9391-19562561dee4\\.system_generated\\logs\\transcript_full.jsonl');

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity
  });

  const urls = new Set();
  for await (const line of rl) {
    const data = JSON.parse(line);
    if (data.type === 'USER_INPUT') {
      const match = data.content.match(/postgresql:\/\/[^\s"']+/g);
      if (match) {
        match.forEach(url => urls.add(url));
      }
    }
  }

  console.log("Found URLs in user input:");
  urls.forEach(url => console.log(url));
}

processLineByLine();
