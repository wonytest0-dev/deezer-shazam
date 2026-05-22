const { chromium } = require("playwright");
const fs = require("fs/promises");
const path = require("path");

const URL =
  "https://kworb.net/itunes/artist/jimin.html";

function getKSTTime() {
  return new Date().toLocaleString(
    "en-GB",
    {
      timeZone: "Asia/Seoul"
    }
  );
}

function detectType(title) {
  const upper = title.toUpperCase();

  if (
    upper.startsWith("ALBUM:")
  ) {
    return "album";
  }

  return "single";
}

async function scrapeDeezerShazam() {

  console.log(
    "🚀 Launching browser..."
  );

  const browser =
    await chromium.launch({
      headless: true
    });

  const page =
    await browser.newPage();

  try {

    await page.goto(URL, {
      waitUntil:
        "domcontentloaded",
      timeout: 60000
    });

    console.log(
      "✅ Page loaded"
    );

    // enable 24h diffs
    await page.click(
      "text=Show 24h diffs"
    );

    console.log(
      "✅ 24h mode enabled"
    );

    await page.waitForTimeout(
      3000
    );

    const text =
      await page
        .locator("body")
        .innerText();

    const lines = text
      .split("\n")
      .map(x =>
        x.trim()
      )
      .filter(Boolean);

    const deezer = [];
    const shazam = [];

    const summaryMap =
      {};

    let currentTitle =
      null;

    let currentPlatform =
      null;

    for (const line of lines) {

      // skip noise
      if (
        line.includes("All services") ||
        line.includes("All markets") ||
        line.includes("Discover more") ||
        line.includes("Historical chart data") ||
        line.includes("Music news blog") ||
        line.includes("Streaming monetization course")
      ) {
        continue;
      }

      // detect title
      const isTitle =
        !line.includes(":") &&
        !line.startsWith("#") &&
        line.length < 60 &&
        !/^\d/.test(line);

      if (isTitle) {

        currentTitle =
          line;

        currentPlatform =
          null;

        continue;
      }

      // platform detect
      if (
        line ===
        "Deezer:"
      ) {
        currentPlatform =
          "deezer";
        continue;
      }

      if (
        line ===
        "Shazam:"
      ) {
        currentPlatform =
          "shazam";
        continue;
      }

      // keluar section
      if (
        line.endsWith(":") &&
        line !==
          "Deezer:" &&
        line !==
          "Shazam:"
      ) {
        currentPlatform =
          null;
      }

      // parse rank
      if (
        currentPlatform &&
        line.startsWith("#")
      ) {

        const matches =
          [
            ...line.matchAll(
              /#(\d+)\s(.+?)\s\((.*?)\)/g
            )
          ];

        for (
          const match of matches
        ) {

          const item = {
            title:
              currentTitle,

            country:
              match[2].trim(),

            rank:
              Number(
                match[1]
              ),

            movement:
              match[3].trim(),

            type:
              detectType(
                currentTitle
              ),

            isTop1:
              Number(
                match[1]
              ) === 1
          };

          // push
          if (
            currentPlatform ===
            "deezer"
          ) {
            deezer.push(
              item
            );
          }

          if (
            currentPlatform ===
            "shazam"
          ) {
            shazam.push(
              item
            );
          }

          // summary
          if (
            !summaryMap[
              currentTitle
            ]
          ) {
            summaryMap[
              currentTitle
            ] = {
              title:
                currentTitle,

              type:
                detectType(
                  currentTitle
                ),

              deezerTop1: 0,

              shazamTop1: 0
            };
          }

          if (
            item.rank ===
            1
          ) {

            if (
              currentPlatform ===
              "deezer"
            ) {
              summaryMap[
                currentTitle
              ]
                .deezerTop1++;
            }

            if (
              currentPlatform ===
              "shazam"
            ) {
              summaryMap[
                currentTitle
              ]
                .shazamTop1++;
            }
          }
        }
      }
    }

    const output = {
      updatedAt:
        getKSTTime() +
        " KST",

      totalEntries:
        deezer.length +
        shazam.length,

      deezer,

      shazam,

      summary:
        Object.values(
          summaryMap
        )
    };

    // create folder
    await fs.mkdir(
      "data",
      {
        recursive: true
      }
    );

    // save
    await fs.writeFile(
      path.join(
        "data",
        "jimin-deezer-shazam.json"
      ),
      JSON.stringify(
        output,
        null,
        2
      ),
      "utf8"
    );

    console.log(
      `✅ Deezer: ${deezer.length}`
    );

    console.log(
      `✅ Shazam: ${shazam.length}`
    );

    console.log(
      "📁 Saved → data/jimin-deezer-shazam.json"
    );

  } catch (err) {

    console.error(
      "❌ Error:",
      err.message
    );

  } finally {

    await browser.close();

  }
}

scrapeDeezerShazam();
