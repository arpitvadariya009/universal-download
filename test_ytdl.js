const ytdlp = require('yt-dlp-exec');

async function test() {
  try {
    const url = 'https://www.youtube.com/watch?v=aqz-KE-bpKQ';
    console.log('Fetching info for:', url);
    const info = await ytdlp(url, {
      dumpJson: true,
      noWarnings: true,
      noCheckCertificate: true,
    });
    console.log('Title:', info.title);
  } catch (error) {
    console.error('Error in test:', error);
  }
}

test();
