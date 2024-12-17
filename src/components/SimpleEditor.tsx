import type {
  EditorDocument,
  EditorUpdate,
  ScrollPosition,
} from "@tutorialkit/components-react/core";
import dayjs from "dayjs";
import CodeMirrorEditor from "@tutorialkit/components-react/core/CodeMirrorEditor";
import FileTree from "@tutorialkit/components-react/core/FileTree";
import { type FileSystemTree, type DirectoryNode } from "@webcontainer/api";
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
    <div className="px-auto">
      <div className="flex h-3rem">
        <h1 className="px-4 py-2 text-[20px] underline link">
          <a href="https://github.com/charlzyx/typeto">
            https://github.com/charlzyx/typeto@^1.1.3
          </a>
        </h1>
      </div>
      <div className="px-2 py-2 h-[calc(100vh-3rem)] flex border border-gray-200 border-solid rounded-sm overflow-hidden">
        <div className="w-1/5  filetree h-full">
          <FileTree
            files={files}
            hideRoot
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
          />
        </div>
        <div className="panel flex flex-col w-full ">
          <div className="codebox w-full flex h-4/5">
            <div className="editor w-1/2 px-auto overflow-auto">
              <CodeMirrorEditor
                theme="light"
                doc={document}
                onChange={onChange}
                onScroll={onScroll}
              />
            </div>
            <div className="h-full w-px bg-gray-200" />
            <div className="w-1/2 text-[13px]">
              <iframe
                id="vhost"
                className="border-none w-full h-full overflow-auto"
                src={previewSrc}
              />
            </div>
          </div>
          {/* <div className="w-full h-px bg-gray-200" /> */}
          <div className="terminal h-1/5 px-2 py-2 w-full">
            {domLoaded && (
              <Suspense>
                <Terminal
                  className="h-full "
                  readonly={false}
                  theme="light"
                  onTerminalReady={setTerminal}
                />
              </Suspense>
            )}
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
    osetSelectedFile((pre) => {
      if (pre !== filePath) {
        webcontainerPromise.then((webcontainer) => {
          webcontainer.fs.writeFile(
            "current",
            filePath + ":" + dayjs().format("YYYY/MM/DD HH:mm:ss.sss")
          );
        });
      }
      return filePath;
    });
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
    return /oas|formily|zod|index.js|package.json/.test(name);
  })
  .sort((a, b) => {
    if (/\.ts$/.test(a)) return -1;
    return 0;
  });

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
