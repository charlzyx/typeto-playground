import type {
  EditorDocument,
  EditorUpdate,
  ScrollPosition,
} from "@tutorialkit/components-react/core";
import dayjs from "dayjs";
import CodeMirrorEditor from "@tutorialkit/components-react/core/CodeMirrorEditor";
import FileTree from "@tutorialkit/components-react/core/FileTree";
import type { FileSystemTree, DirectoryNode } from "@webcontainer/api";
import type { Terminal as XTerm } from "@xterm/xterm";
import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useWebContainer } from "../hooks/useWebContainer.js";
import { FILES } from "../files.js";

const Terminal = lazy(
  () => import("@tutorialkit/components-react/core/Terminal")
);

export function SimpleEditor() {
  const [domLoaded, setDomLoaded] = useState(false);

  const {
    setTerminal,
    previewSrc,
    document,
    files,
    onChange,
    onScroll,
    selectedFile,
    setSelectedFile,
  } = useSimpleEditor();

  useEffect(() => {
    setDomLoaded(true);
  }, []);

  return (
    <div className="max-w-screen-lg mx-auto">
      <div className="flex ">
        <h1 className="text-lg mx-4 my-4 underline">
          <a href="https://github.com/charlzyx/typeto">
            github.com/charlzyx/typeto
          </a>
        </h1>
      </div>
      <div className="mx-4 my-4 h-[calc(100vh-2rem)] flex flex-col border border-gray-200 border-solid rounded-sm overflow-hidden">
        <div className="flex h-1/2">
          <FileTree
            className="w-1/4 flex-shrink-0 text-sm mt-2"
            files={files}
            hideRoot
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
          />
          <div className="w-px flex-shrink-0 h-full bg-gray-200" />
          <CodeMirrorEditor
            theme="light"
            doc={document}
            onChange={onChange}
            onScroll={onScroll}
            className="h-full flex-grow max-w-[calc(75%-1px)] text-[13px]"
          />
        </div>
        <div className="h-px bg-gray-200" />
        <div className="flex p-0 m-0 h-1/2">
          <div className="w-1/4 h-full">
            {domLoaded && (
              <Suspense>
                <Terminal
                  className="h-full"
                  readonly={false}
                  theme="light"
                  onTerminalReady={setTerminal}
                />
              </Suspense>
            )}
          </div>
          <div className="w-px flex-shrink-0 h-full bg-gray-200" />
          <div className="h-full flex-grow max-w-[calc(75%-1px)] text-[13px]">
            <iframe
              id="vhost"
              className="border-none w-full h-full"
              src={previewSrc}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function useSimpleEditor() {
  const webcontainerPromise = useWebContainer();
  const [terminal, setTerminal] = useState<XTerm | null>(null);
  const [selectedFile, osetSelectedFile] = useState("/oas.ts");
  const [documents, setDocuments] =
    useState<Record<string, EditorDocument>>(FILES);
  const [previewSrc, setPreviewSrc] = useState<string>("");

  const document = documents[selectedFile];

  const setSelectedFile = useCallback(async (filePath: string) => {
    osetSelectedFile(filePath);
    const webcontainer = await webcontainerPromise;

    webcontainer.fs.writeFile(
      "current",
      filePath + ":" + dayjs().format("YYYY/MM/DD HH:mm:ss.sss")
    );
  }, []);

  async function onChange({ content }: EditorUpdate) {
    setDocuments((prevDocuments) => ({
      ...prevDocuments,
      [selectedFile]: {
        ...prevDocuments[selectedFile],
        value: content,
      },
    }));

    // fetch(selectedFile.replace(/\.*$/, ""));
    const webcontainer = await webcontainerPromise;

    await webcontainer.fs.writeFile(selectedFile, content);
    webcontainer.fs.writeFile(
      "current",
      selectedFile + ":" + dayjs().format("YYYY/MM/DD HH:mm:ss.sss")
    );
  }

  function onScroll(scroll: ScrollPosition) {
    setDocuments((prevDocuments) => ({
      ...prevDocuments,
      [selectedFile]: {
        ...prevDocuments[selectedFile],
        scroll,
      },
    }));
  }

  useEffect(() => {
    (async () => {
      const webcontainer = await webcontainerPromise;

      webcontainer.on("server-ready", (_port, url) => {
        setPreviewSrc(url);
      });

      await webcontainer.mount(toFileTree(FILES));
    })();
  }, []);

  useEffect(() => {
    if (!terminal) {
      return;
    }

    run(terminal);

    async function run(terminal: XTerm) {
      const webcontainer = await webcontainerPromise;
      const process = await webcontainer.spawn("jsh", ["--osc"], {
        terminal: {
          cols: terminal.cols,
          rows: terminal.rows,
        },
      });

      let isInteractive = false;
      let resolveReady!: () => void;

      const jshReady = new Promise<void>((resolve) => {
        resolveReady = resolve;
      });

      process.output.pipeTo(
        new WritableStream({
          write(data) {
            if (!isInteractive) {
              const [, osc] = data.match(/\x1b\]654;([^\x07]+)\x07/) || [];

              if (osc === "interactive") {
                // wait until we see the interactive OSC
                isInteractive = true;

                resolveReady();
              }
            }

            terminal.write(data);
          },
        })
      );

      const shellWriter = process.input.getWriter();

      terminal.onData((data) => {
        if (isInteractive) {
          shellWriter.write(data);
        }
      });

      await jshReady;

      shellWriter.write("npm install && npm start\n");
    }
  }, [terminal]);

  return {
    setTerminal,
    previewSrc,
    selectedFile,
    setSelectedFile,
    onChange,
    onScroll,
    document,
    files: FILE_PATHS,
  };
}

const FILE_PATHS = Object.keys(FILES)
  .filter((name) => {
    return /oas|formily|zod|output/.test(name);
  })
  .sort((a, b) => {
    if (/output/.test(a)) return -1;
    return 0;
  });

function stripIndent(string: string) {
  const indent = minIndent(string.slice(1));

  if (indent === 0) {
    return string;
  }

  const regex = new RegExp(`^[ \\t]{${indent}}`, "gm");

  return string.replace(regex, "").trim();
}

function minIndent(string: string) {
  const match = string.match(/^[ \t]*(?=\S)/gm);

  if (!match) {
    return 0;
  }

  return match.reduce((acc, curr) => Math.min(acc, curr.length), Infinity);
}

export function toFileTree(
  files: Record<string, EditorDocument>
): FileSystemTree {
  const root: FileSystemTree = {};

  for (const filePath in files) {
    const segments = filePath.split("/").filter((segment) => segment);

    let currentTree: FileSystemTree = root;

    for (let i = 0; i < segments.length; ++i) {
      const name = segments[i];

      if (i === segments.length - 1) {
        currentTree[name] = {
          file: {
            contents: files[filePath].value,
          },
        };
      } else {
        let folder = currentTree[name] as DirectoryNode;

        if (!folder) {
          folder = {
            directory: {},
          };

          currentTree[name] = folder;
        }

        currentTree = folder.directory;
      }
    }
  }

  return root;
}
