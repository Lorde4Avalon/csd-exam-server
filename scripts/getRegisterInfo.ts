import { readFileSync } from "fs";
import { getStudentInfoById } from "../src/externalApi";

if (!process.argv[2]) {
  console.error("Missing input file path");
}

const accounts = readFileSync(process.argv[2], "utf-8");

Promise.all(
  accounts.split("\n")
    .filter((x) => x)
    .map((x) => +x).map((id) => {
      return getStudentInfoById(id)
        .then((x) => ({
          time: x.createdAt.substr(5, 5),
        }));
    }),
).then((students) => {
  printCSV(students);
});

function printCSV(obj: any[]) {
  const keys = Object.keys(obj[0]);
  console.info(keys.map(csvEscape).join(","));
  for (const line of obj) {
    console.info(
      keys.map((key) => line[key]).map((val) => `${val}`).map(csvEscape).join(
        ",",
      ),
    );
  }
}

function csvEscape(str: string) {
  if (str.includes("\n") || str.includes('"') || str.includes(",")) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}
