import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { Project } from "ts-morph";
import { transform } from "@typeto/oas";
import fs from "node:fs";
import { html, raw } from "hono/html";

const project = new Project();

const app = new Hono();
app
  .get("/", (c) => {
    const hhtml = fs.readFileSync("./src/index.html").toString();
    console.log("🚀 ~ .get ~ hhtml:", hhtml);
    // return c.html(html`${hhtml}`);
    return c.html(html`
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>Hello, world!</title>
        </head>
        <body>
          <!-- <script src="./src/index.js"></script> -->
          <script>
            document.body.innerHTML = \`
<h1>Hello, world!</h1>

<div id="click"> CLICK </div>
\`;
          </script>
          <script>
            document.querySelector("#click").addEventListener("click", () => {
              fetch("/oas");
            });
          </script>
        </body>
      </html>
    `);
  })
  .get("/oas", (c) => {
    const input = fs.readFileSync("./input.ts").toString();
    // console.log("🚀 ~ .get ~ input:", input);
    project.createSourceFile("input.ts", input, { overwrite: true });
    const ret = transform(project);
    console.log("🚀 ~ .get ~ ret:", ret);
    c.json({ data: ret });
  });

serve(app);
