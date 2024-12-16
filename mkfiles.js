const fs = require("fs");
const path = require("path");

/**
 * 遍历目录并生成文件描述对象
 * @param {string} dirPath - 要遍历的目录路径
 * @returns {Object} - 按照指定格式生成的文件描述对象
 */
function generateFileTree(dirPath, result = {}) {
  const items = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);
    console.log("🚀 ~ generateFileTree ~ itemPath:", itemPath);
    if (item.isDirectory()) {
      // result[item.name] = {
      //   directory:
      // };
      generateFileTree(itemPath, result);
    } else if (item.isFile()) {
      const contents = fs.readFileSync(itemPath, "utf-8");
      result[itemPath.replace("vhost", "")] = {
        filePath: itemPath.replace("vhos", ""),
        loading: false,
        value: contents,
      };
    }
  }

  return result;
}

// 示例使用
const targetDirectory = "./vhost"; // 替换为你的目标目录路径
const fileTree = generateFileTree(targetDirectory);
console.log("🚀 ~ fileTree:", fileTree);

const files = "export const FILES = " + JSON.stringify(fileTree, null, 2);

fs.writeFileSync("./src/files.ts", "", "utf-8");
fs.writeFileSync("./src/files.ts", files, "utf-8");
