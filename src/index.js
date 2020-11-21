import xlsx from "xlsx";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fetch from "node-fetch";
import { JSDOM } from "jsdom";
import rimraf from "rimraf";
import { appendFile } from "fs";
import { promisify } from "util";

const appendFileAsync = promisify(appendFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const resultFile = join(__dirname, "../res.txt");
rimraf.sync(resultFile);

console.log("Reading csv...");
const sheet = xlsx.readFile(join(__dirname, "./uszips.csv")).Sheets.Sheet1;
const json = xlsx.utils.sheet_to_json(sheet);

let states = [];
if (process.argv[2] === "midwest") {
  states = ["IL", "IN", "MI", "MO", "KY", "WI", "IA"];
} else {
  states = [...new Set(json.map(({ state_id }) => state_id))];
}

const getStock = async (state) => {
  console.log(`Checking ${state}...`);
  const zipCodesForState = json
    .filter(({ state_id }) => state_id === state)
    .map(({ zip }) => zip);

  const product = process.argv[3] === "digital" ? "207-43-0001" : "207-43-0001";

  const targetsWithStock = zipCodesForState.map(async (zip) => {
    console.log(`Checking ${zip}`);
    try {
      const res = await fetch(
        `https://popfindr.com/results?pid=${product}&zip=${zip}&range=25&webpage=target&token=03AGdBq26qwf0b1Wya10AyaaWYrQVSZpINWGKvM3a7rMWeBmIm5tWBjifvJBnHCQcf8rg4dtKC6mLl_p18O67F002oY3a--47fy179HjyxXHFm0uLtHTPfFDDGlAWYl-Cvb7KDK1DtLSv8HUgmYMkJ4hzAnFJdIkIl2x3PYz0nH8z692Ngef02un2TCG-4iAK5LNk1eHtjHxDvAuQjcF-KTY9X1ajs7GVAMZEPRPxAGehw_3AoPBQdAlY_n9VQvt0lEjLByN9jvfo_Noj7tFkLiY2saQhxLo2pjENG7nmSApOuWFiScnP_ntfF0rK82SCYek-P9ULlQXNtuEHjlzl3rWvzalNu3wT-Ar3IsvE6tyMAi80NcU0YvmwiY4dQ6s7DYdPFh1aEFmoHL23bTAmVMsVLYuxWdcGfx2XZcfHD14faX99E0dvf33QnbWO3BDBytQ-Fvt7xO9OS`
      );

      const txt = await res.text();
      const DOM = new JSDOM(txt);
      const tableRows = DOM.window.document.querySelectorAll("tr");
      const rowsWithStock = [...tableRows]
        .filter(({ className }) => className === "table-random-color")
        .filter((row) => row.lastChild.textContent !== "0")
        .map((row) => row.firstChild.textContent);

      console.log(`${zip} check complete`);
      return rowsWithStock;
    } catch (e) {
      console.log(`${zip} failed`);
    }
  });

  const result = (await Promise.all(targetsWithStock))
    .flat(Infinity)
    .join("\n");

  return appendFileAsync(resultFile, result);
};

for (const state of states) {
  await getStock(state);
}

process.exit(0);
