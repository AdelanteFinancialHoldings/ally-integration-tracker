console.log("\x1B[2J\x1B[0f");
const fs = require("fs");
const csv = require("csv-parser");
const Wappalyzer = require("wappalyzer");
const https = require("https");

const allies = [];
const result = [];

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

  const addResults = (slug, website, ecommerce, index) => {
    result.push({
      slug,
      website,
      ecommerce,
    });
    console.log("DONE ANALAZING:", website, ecommerce);
  };
  allies
    .filter(
      (ally) =>
        ally.channel !== "PAY_LINK" &&
        ally.active === "TRUE" &&
        ally.ally_state === "ACTIVE"
    )
    .forEach(async (ally, index) => {
      console.log("ANALAZING:", ally.website);
      if (
        ally.website.indexOf("instagram") > 0 ||
        ally.website.indexOf("facebook") > 0
      ) {
        addResults(ally.slug, ally.website, "NOT_AVAILABLE", index);
      } else {
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
        if (!ecommerce) {
          https
            .get(ally.website, () => {
              addResults(ally.slug, ally.website, "CUSTOM/WORDPRESS", index);
            })
            .on("error", () => {
              addResults(ally.slug, ally.website, "NOT_AVAILABLE", index);
            });
        } else {
          addResults(ally.slug, ally.website, ecommerce.name, index);
        }
      }
    });
};

fs.createReadStream("allies.csv")
  .pipe(csv())
  .on("data", (data) => {
    allies.push(data);
  })
  .on("end", () => {
    checkWebsites();
  });
