const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
const {executablePath} = require('puppeteer');
const fs = require('fs').promises

puppeteer.use(StealthPlugin());

async function generateProvinsi (page) {
    console.log('[#] Generating Province Data')
    var result = [];
    var data = await page.$$('body > table > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(2) > td > table:nth-child(4) > tbody:nth-child(2) > tr');
    
    for (let el of data) {
        var href = await el.evaluate(x => x.querySelector('td:nth-child(2) > a.ktv').getAttribute('href'));
        var title = await el.evaluate(x => x.querySelector('td:nth-child(2) > a.ktv').textContent.trim());
        var postalCode = await el.evaluate(x => x.querySelector('td:nth-child(4)').textContent.trim());

        if (title != 'Jumlah Total') {
            result.push({
                name: title,
                type: 'provinsi',
                postalCode: postalCode.replace('Kode POS : ', ''),
                url: href
            });
        }
    }

    console.log('[#] Generating Province Data - Successful')
    await fs.writeFile('./assets/province.json', JSON.stringify(result, null, 2), 'utf8');
    return result;
};

async function generateKota (page, provinsi) {
    console.log('[#] Generating City Data')
    for (var i = 0; i < provinsi.length; i++) {
        var url = provinsi[i].url;
        await page.goto(url);

        var kota = [];

        var data = await page.$$('.cstr');
        for (let el of data) {
            var type = await el.evaluate(x => x.querySelector('td:nth-child(2)').textContent.trim());
            var href = await el.evaluate(x => x.querySelector('td:nth-child(3) > a.ktu').getAttribute('href'));
            var title = await el.evaluate(x => x.querySelector('td:nth-child(3) > a.ktu').textContent.trim());
            var postalCode = await el.evaluate(x => x.querySelector('td:nth-child(4) > a.ktu').textContent.trim());

            kota.push({
                name: title,
                type: type,
                postalCode: postalCode.replace('Kode POS : ', ''),
                url: href
            });
        }

        provinsi[i].sub = kota;
    }

    console.log('[#] Generating City Data - Successful')
    await fs.writeFile('./assets/city.json', JSON.stringify(provinsi, null, 2), 'utf8');
    return provinsi;
}

async function generateKecamatan (page, kota) {
    console.log('[#] Generating Subdistrict Data')
    for (var i = 0; i < kota.length; i++) {
        for (var j = 0; j < kota[i].sub.length; j++) {
            var url = kota[i].sub[j].url;
            await page.goto(url);

            var kecamatan = [];

            var data = await page.$$('body > table > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(2) > td > table:nth-child(4) > tbody:nth-child(2) > tr');
            for (let el of data) {
                var title = await el.evaluate(x => x.querySelector('td:nth-child(2) > a.ktu').textContent.trim());
                var href = await el.evaluate(x => x.querySelector('td:nth-child(2) > a.ktu').getAttribute('href'));
                var postalCode = await el.evaluate(x => x.querySelector('td:nth-child(3)').textContent.trim());
                var type = 'Kecamatan';

                kecamatan.push({
                    name: title,
                    type: type,
                    postalCode: postalCode.replace('Kode POS : ', ''),
                    url: href
                })
            }

            kota[i].sub[j].sub = kecamatan;
        }
    }

    console.log('[#] Generating Subdistrict Data - Successful')
    await fs.writeFile('./assets/subdistrict.json', JSON.stringify(kota, null, 2), 'utf8');
    return kota;
}

async function generateKelurahan (page, kecamatan) {
    console.log('[#] Generating Village Data')

    for (var i = 0; i < kecamatan.length; i++) {
        for (var j = 0; j < kecamatan[i].sub.length; j++) {
            for (var k = 0; k < kecamatan[i].sub[j].sub.length; k++) {
                var url = kecamatan[i].sub[j].sub[k].url;
                await page.goto(url);

                var kelurahan = [];

                var data = await page.$$('body > table > tbody > tr > td > table:nth-child(2) > tbody > tr:nth-child(2) > td > table > tbody > tr:nth-child(2) > td > table:nth-child(4) > tbody:nth-child(2) > tr');
                for (let el of data) {
                    var title = await el.evaluate(x => x.querySelector('td:nth-child(3)').textContent.trim());
                    var href = await el.evaluate(x => x.querySelector('td:nth-child(3) > a.ktu').getAttribute('href'));
                    var postalCode = await el.evaluate(x => x.querySelector('td:nth-child(2)').textContent.trim());
                    var type = 'Kelurahan';

                    kelurahan.push({
                        name: title,
                        type: type,
                        postalCode: postalCode.replace('Kode POS ', ''),
                        url: href
                    })
                }

                kecamatan[i].sub[j].sub[k].sub = kelurahan;
            }
        }
    }

    console.log('[#] Generating Village Data - Successful')
    await fs.writeFile('./assets/village.json', JSON.stringify(kecamatan, null, 2), 'utf8');

    return kecamatan;
}

const generateKodePos = () => new Promise (async (resolve, reject) => {
    const browser = await puppeteer.launch({
        headless: false,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
        executablePath: executablePath(),
    });

    var url = 'https://kodepos.nomor.net/_kodepos.php?_i=provinsi-kodepos';
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(90000);
    await page.goto(url);

    var provinsi = await generateProvinsi(page);
    var kota = await generateKota(page, provinsi);
    var kecamatan = await generateKecamatan(page, kota);
    var kelurahan = await generateKelurahan(page, kecamatan);

    await browser.close();
    resolve(kelurahan)
});

(async () => {
    var result = await generateKodePos();
    // await fs.writeFile('./data.json', JSON.stringify(result, null, 2), 'utf8');
})();