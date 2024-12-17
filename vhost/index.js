import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Project } from "ts-morph";
import { transform as transformOAS } from "@typeto/oas";
import { transform as transformZOD } from "@typeto/zod";
import { transform as transformFormily } from "@typeto/formily-schema";
import fs from "node:fs";
import { html, raw } from "hono/html";

const index = fs.readFileSync("./index.html").toString();
const transforms = {
  get oas() {
    return transformOAS;
  },
  get zod() {
    return transformZOD;
  },
  get "formily-schema"() {
    return transformFormily;
  },
};
const pool = {
  oas: new Project(),
  zod: new Project(),
  "formily-schema": new Project(),
};
const app = new Hono();
app.get("/", (c) => {
  return c.html(raw(index));
});

app.get("/current", (c) => {
  const current = fs.readFileSync("./current").toString();
  return c.json({ content: current });
});
app.get("/output", (c) => {
  const current = fs.readFileSync("./current").toString();
  if (!/\.ts$/.test(current)) return;
  const [filename] = current.split(":");
  const [type] = filename.replace("/", "").split(".");
  const input = fs.readFileSync("./" + filename).toString();

  const project = pool[type];
  const transform = transforms[type];
  project.createSourceFile(type + ".ts", input, { overwrite: true });
  const ret = transform(project);
  const content = typeof ret === "string" ? ret : JSON.stringify(ret, null, 2);
  return c.json({ content });
});
serve(app);
