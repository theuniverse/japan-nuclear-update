const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const url = require('url');
const path = require('path');
const extract = require('pdf-text-extract');
const exec = require('child_process').exec;

const INDEX_PAGE = 'http://radioactivity.nsr.go.jp/en/list/192/list-1.html';

async function findLink() {
  return new Promise((resolve, reject) => {
    request(INDEX_PAGE, (error, response, body) => {
      if (error) {
        reject(error);
      }

      console.log('statusCode:', response && response.statusCode); // Print the response status code if a response was received
      const $ = cheerio.load(body);
      resolve(url.resolve(INDEX_PAGE, $('div.link-2 ul li a').attr('href')));
    });
  });
}

async function retrieveFile(url) {
  return new Promise((resolve, reject) => {
    const stream = request(url).pipe(fs.createWriteStream('data.pdf'));
    stream.on('finish', () => {
      const filePath = path.join(__dirname, 'data.pdf');
      extract(filePath, (err, pages) => {
        if (err) {
          console.log(err);
          reject(err);
        }

        resolve(pages);
      });
    });
  });
}

async function exec_sync(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.log(error);
        reject(stderr);
      }

      resolve(stdout);
    });
  });
}

(async function() {
  const link = await findLink();
  console.log(link);

  const pages = await retrieveFile(link);
  const lines = pages[0].split('\n');
  const usefulLines = lines.reduce((result, line) => {
    const columns = line.trim().split(/\s+/).filter(column => {
      return column !== '(*1)';
    });

    if (columns.length > 9 || columns.length < 7) {
      return result;
    }

    const columnNum = parseInt(columns[0], 10);
    if (columnNum < 48 && columnNum > 0) {
      result.push(columns);
    }

    return result;
  }, []);

  const [, start, end] = link.replace('.pdf', '').split('_');
  let title = [];
  let table = ['|  | 都道府县 | 海拔1m处预计值(𝜇𝘚𝘷⧸ℎ) |\n|---|---|---|'];
  usefulLines.forEach(line => {
    const [i, name, , , , value1, value2] = line;
    const index = parseInt(i, 10);
    const value = parseFloat(value2) || parseFloat(value1) || '无测量值';
    if ([1, 13, 27, 47].includes(index)) {
      title.push([name, value + '𝜇𝘚𝘷⧸ℎ'].join(' '));
      table.push('| ' + [index, '**' + name + '**', value].join(' | ') + ' |');
    } else {
      table.push('| ' + [index, name, value].join(' | ') + ' |');
    }
  });

  const finalTitle = [start, end].join('-') + ': ' + title.join('; ');
  const finalContent = table.join('\n');

  const created = await exec_sync('cd blog && hexo new "' + finalTitle + '"');
  const filePath = created.split('/').pop().replace('\n', '');
  await exec_sync('echo "\n' + finalContent + '" >> "blog/source/_posts/' + filePath + '"');
}());
