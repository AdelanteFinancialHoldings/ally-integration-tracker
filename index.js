console.log("\x1B[2J\x1B[0f");
const fs = require("fs");
const csv = require("csv-parser");
const Wappalyzer = require("wappalyzer");
const https = require("https");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;

const allies = [];
const result = [];
const intervals = {};

const checkWebsites = async () => {
  const options = {
    debug: false,
    delay: 500,
    headers: {},
    maxDepth: 3,
    maxUrls: 10,
    maxWait: 1000,
    recursive: true,
    probe: true,
    proxy: false,
    userAgent: "Wappalyzer",
    htmlMaxCols: 2000,
    htmlMaxRows: 2000,
    noScripts: false,
    noRedirect: false,
  };
  const instance = new Wappalyzer(options);
  await instance.init();

  const addResults = (slug, website, ecommerce, channel) => {
    result.push({
      slug,
      website,
      ecommerce,
      channel,
    });
    console.log("done analyzing:", website, ecommerce);
  };
  await Promise.all(
    allies
      .filter(
        (ally) =>
          ally.channel !== "PAY_LINK" &&
          ally.active === "TRUE" &&
          ally.ally_state === "ACTIVE"
      )
      .map(async (ally) => {
        try {
          if (
            ally.website.indexOf("instagram") > 0 ||
            ally.website.indexOf("facebook") > 0
          ) {
            addResults(ally.slug, ally.website, "NOT_AVAILABLE", ally.channel);
          } else {
            const timeoutid = setTimeout(() => {
              console.log("fail at:", ally.website);
            }, 60000);
            intervals[ally.slug] = timeoutid;
            const site = await instance.open(ally.website);
            const results = await site.analyze();

            const [ecommerce] = results.technologies.filter(
              (technology) =>
                technology.website !==
                  "https://www.wappalyzer.com/technologies/ecommerce/cart-functionality" &&
                technology.categories.some(
                  (category) => category.slug === "ecommerce"
                )
            );
            clearTimeout(intervals[ally.slug]);
            intervals[ally.slug] = undefined;

            if (!ecommerce) {
              https
                .get(ally.website, () => {
                  addResults(
                    ally.slug,
                    ally.website,
                    "CUSTOM/WORDPRESS",
                    ally.channel
                  );
                })
                .on("error", () => {
                  addResults(
                    ally.slug,
                    ally.website,
                    "NOT_AVAILABLE",
                    ally.channel
                  );
                });
            } else {
              addResults(ally.slug, ally.website, ecommerce.name, ally.channel);
            }
          }
        } catch (error) {
          console.log(error);
        }
      })
  );
  const header = [
    { id: "slug", title: "SLUG" },
    { id: "website", title: "WEBSITE" },
    { id: "ecommerce", title: "ECOMMERCE" },
    { id: "channel", title: "CHANNEL" },
  ];
  const csvWriter = createCsvWriter({
    path: "output.csv",
    header: header,
  });

  // Write the data to the CSV file
  csvWriter
    .writeRecords(result)
    .then(() => console.log("The CSV file was written successfully!"));
};

fs.createReadStream("allies.csv")
  .pipe(csv())
  .on("data", (data) => {
    allies.push(data);
  })
  .on("end", () => {
    checkWebsites();
  });
