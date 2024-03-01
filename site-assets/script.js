// Variables

showdown.setFlavor("github");

const converter = new showdown.Converter({
  noHeaderId: true,
  strikethrough: true,
  tables: true,
  ghCodeBlocks: true,
  tasklists: true,
  simpleLineBreaks: true,
  openLinksInNewWindow: true,
  backslashEscapesHTMLTags: true,
});

let selectors = {
  preview: document.querySelector("#preview"),
  previewWrapper: document.querySelector("#preview-wrapper"),
  sidebar: document.querySelector("#sidebar"),
  elementsList: document.querySelector("#elements-list"),
  properties: document.querySelector("#properties"),
  requiredInputs: document.querySelector("#required-inputs"),
  dump: document.querySelector("#dump"),
  codeEditorWrapper: document.querySelector("#code-editor-wrapper"),
  propertiesEditor: document.querySelector("#properties-editor"),
};

let assetsExplorerLoaded = false;
let templatesLoaded = false;
let sessionSave;

const contextMenus = {
  element: [
    `<ul class="context-menu element-context-menu">
  <li class="edit">🖋️ Edit</li>
  <li class="duplicate">✨ Duplicate</li>
  <li class="copy-as-md">📋 Copy as MD</li>
  <li class="delete">❌ Delete</li>
</ul>`,
    (menu, node) => {
      node.classList.add("cmenu-target");
      menu.querySelector(".edit").onclick = () => {
        openPropertiesEditor(node);
      };
      menu.querySelector(".delete").onclick = () => {
        removeElement(node);
      };
      menu.querySelector(".duplicate").onclick = () => {
        duplicateElement(node);
      };
      menu.querySelector(".copy-as-md").onclick = () => {
        copy(parse.html(node.outerHTML));
      };
    },
  ],
  asset: [
    `<ul class="context-menu asset-context-menu">
    <li class="copy">📋 Copy ID</li>
  </ul>`,
    (menu, node) => {
      menu.querySelector('.copy').onclick = () => {
        copy(node.querySelector('p').innerText);
      }
    }
  ]
};

// Parsers

const parse = {
  html: (html) => {
    const tempElement = document.createElement("div");
    tempElement.innerHTML = html;
    tempElement.querySelectorAll("*").forEach((element) => {
      if (element.getAttribute("data-srcv")) {
        element.src = element.getAttribute("data-srcv");
      }
      if (element.getAttribute("data-task")) {
        if (element.getAttribute("data-task") == "checked") {
          element.innerText = "[x]" + element.innerText;
          // element.querySelector('input').remove();
        } else {
          element.innerText = "[ ]" + element.innerText;
          // element.querySelector('input').remove();
        }
      }
      if (element.getAttribute("data-href")) {
        element.href = element.getAttribute("data-href")
        element.removeAttribute("data-href");
      }
      element.removeAttribute("class");
      element.removeAttribute("draggable");
      if (element.hasAttribute("data-skip")) {
        const tagName = element.tagName.toLowerCase();
        element.outerHTML = element.outerHTML
          .replaceAll(`<${tagName}`, `MFO(SKIP)< ${tagName}`)
          .replaceAll(`</${tagName}`, `MFO(SKIP)< /${tagName}`);
      }
    });
    return converter
      .makeMarkdown(tempElement.innerHTML)
      .replaceAll("MFO(SKIP)< ", "<")
      .replaceAll("MFO(SKIP)< /", "</")
      .replaceAll("<!-- -->", "")
      .replaceAll(/\n{2,}/g, "\n\n")
      .replaceAll('<br>','\n');
  },
  mfo: (content) => {
    const type = content.split("\n")[0];
    content = content.split("\n").slice(1).join("\n");

    if (type == "MFO(ELEMENT)") {
      elements[content.split("\n")[0]] = content
        .split("\n")
        .slice(1)
        .join("\n");
    } else if (type == "MFO(LOAD)") {
      render(content, false);
    } else if (type == "MFO(LOAD_EXTERNAL)") {
      fetch(content)
        .then((res) => res.text())
        .then((data) => {
          render(data, false);
        });
    } else if (type == "MFO(TEMPLATE)") {
    } else if (type == "MFO(PLUGIN)") {
      eval(content);
    }
  },
  htmlFromPreview: () => {
    return parse.html(selectors.preview.innerHTML);
  },
};

function loadMFOFile() {
  var input = document.createElement('input');
  input.type = 'file';
  input.multiple = false;
  input.accept = '.mfo';
  input.addEventListener('change', function (event) {
    var file = event.target.files[0];
    if (file) {
      if (file.name.endsWith('.mfo')) {
        var reader = new FileReader();
        reader.onload = function (e) {
          parse.mfo(e.target.result)
          loadElements()
        };
        reader.readAsText(file);
      } else {
        console.error('Invalid file type. Please select a .mfo file.');
      }
    }
  });

  // Trigger a click event to open the file explorer
  input.click();
}

function parseMd(content, elementName = "", ignoreRequired = false) {
  document.querySelector("#required-inputs .contents").innerHTML = "";
  document.querySelector("#required-inputs > button").remove();
  selectors.requiredInputs.innerHTML += "<button>Done</button>";
  const tempElement = document.createElement("div");
  tempElement.innerHTML = converter.makeHtml(content);
  let noadd = false;
  let previousElement = '';

  tempElement.querySelectorAll("*").forEach((element) => {
    const tagname = element.tagName.toLowerCase();
    const element_content = element.textContent.trim() || "";
    const element_src = element.src || "";
    const regexMFO = /.*?MFO[{(](\w+)(?:,([^)]+))?[})]/;
    element.classList.add(uuid());

    // if (previousElement == 'UL' && element.tagName == 'LI') {
    //   previousElement = element.tagName;
    //   return;
    // }

    previousElement = element.tagName;
    
    if (element.classList.contains('task-list-item')) {
      if (element.querySelector('input').checked) {
        element.setAttribute('data-task', 'checked')
      } else {
        element.setAttribute('data-task', 'unchecked')
      }
    }

    if (tagname == 'a') {
      element.setAttribute('data-href', element.href);
      element.removeAttribute('href');
    }

    if (regexMFO.test(element_content)) {
      const match = element_content.match(regexMFO);
      const text = match[2] ? match[2] : "";

      switch (true) {
        case match[1] == "I":
          element.textContent = text;
          break;
        case match[1].startsWith("RI"):
          noadd = true;
          selectors.requiredInputs.classList.add("active");
          const type = match[1].substring(2);
          element.textContent = text;

          const uuied = "MFOR" + randomString(6);

          document.querySelector("#required-inputs .name").innerText =
            elementName;

          if (type == "T") {
            document.querySelector(
              "#required-inputs .contents",
            ).innerHTML += `<textarea class="t1" id="T-${uuied}" placeholder="Type here...">${
              text ? text : ""
            }</textarea>`;
          } else {
            document.querySelector(
              "#required-inputs .contents",
            ).innerHTML += `<input value="${
              text ? text : ""
            }" class="t1" id="T-${uuied}" type="text" placeholder="Type here...">`;
          }

          setTimeout(() => {
            document
              .querySelector(`#required-inputs .contents #T-${uuied}`)
              .addEventListener("input", (e) => {
                element.innerText = e.target.value || e.target.innerText;
              });
          }, 5);

          break;
        case match[1] == "RAN":
          if (text) {
            element.textContent = randomString(parseInt(text));
          } else {
            element.textContent = randomString(5);
          }
          break;
        case match[1] == "RANI":
          if (text) {
            element.textContent = randomString(parseInt(text));
          } else {
            element.textContent = randomString(5);
          }
          break;
        case match[1] == "UUID":
          element.textContent = uuid();
          break;
        default:
          console.log("Other cases - e");
          break;
      }
    } else if (regexMFO.test(element_src)) {
      const matches = [
        ...element_src.matchAll(/MFO[{(](\w+)(?:,([^)]+))?[})]/g),
      ];

      matches.forEach((match) => {
        const text = match[2] ? match[2] : "";
        switch (true) {
          case match[1] == "S":
            noadd = true;
            selectors.requiredInputs.classList.add("active");
            element.src = text;

            const uuied = "MFOIMG-" + randomString(6);

            document.querySelector("#required-inputs .name").innerText =
              elementName;

            document.querySelector(
              "#required-inputs .contents",
            ).innerHTML += `<input value="${
              text ? text : ""
            }" class="t1" id="T-${uuied}" type="text" placeholder="Type here...">`;

            setTimeout(() => {
              document
                .querySelector(`#required-inputs .contents #T-${uuied}`)
                .addEventListener("input", (e) => {
                  element.src = e.target.value || e.target.innerText;
                });
            }, 5);

            break;
          case match[1] == "RV":
            if (!ignoreRequired) {
              const uuide = "MFORV-" + randomString(6);
              noadd = true;
              selectors.requiredInputs.classList.add("active");
              document.querySelector("#required-inputs .name").innerText =
                elementName;
              document.querySelector(
                "#required-inputs .contents",
              ).innerHTML += `<p class="label">${
                text ? text : ""
              }</p><input class="t1" id="T-${uuide}" type="text" placeholder="${
                text ? text : "Type here..."
              }">`;
              setTimeout(() => {
                document
                  .querySelector(`#required-inputs .contents #T-${uuide}`)
                  .addEventListener("input", (e) => {
                    element.src = element
                      .getAttribute("data-srcv")
                      .replace(match[0], e.target.value);
                    element.setAttribute(`data-${match[2]}`, e.target.value);
                  });
              }, 5);
            }

            element.setAttribute("data-srcv", element.src);
            // element.src = text;

            break;
          default:
            console.log("Other cases");
            break;
        }
      });
    } else {
      selectors.requiredInputs.classList.remove("active");
    }
    element.classList.add("select");
    element.draggable = true;
    // const wrapperDiv = document.createElement('div');
    // wrapperDiv.id = 'awd'
    // wrapperDiv.classList.add('select');
    // element.parentNode.insertBefore(wrapperDiv, element);
    // wrapperDiv.appendChild(element);
  });

  if (noadd) {
    document
      .querySelector("#required-inputs > button")
      .addEventListener("click", () => {
        selectors.requiredInputs.classList.remove("active");
        selectors.preview.innerHTML += tempElement.innerHTML;
      });
    return ["MFO(R:1)"];
  } else {
    return [tempElement.innerHTML];
  }
}

// Save data

let saveInterval = setInterval(() => {
  saveData();
}, 10000)

function saveData() {
  const data = selectors.preview.innerHTML;
  localStorage.setItem('save', data);
}

function resetSaveInterval() {
  saveInterval = setInterval(() => {
    saveData();
  }, 10000)
}

// Load data

if (localStorage.getItem('save')) {
  selectors.preview.innerHTML = localStorage.getItem('save');
}

// Navigation

function goToPage(page, button) {
  document
    .querySelectorAll("#navigation button")
    .forEach((e) => e.classList.remove("active"));
  button.classList.add("active");

  selectors.codeEditorWrapper.classList.remove("active");
  document.querySelector("#export-wrapper").classList.remove("active");
  document.querySelector("#assets-explorer").classList.remove("active");

  if (document.querySelector("#templates").classList.contains("active")) {
    document.querySelector("#templates").classList.remove("active");
    selectors.preview.innerHTML = sessionSave;
    resetSaveInterval();
  }

  if (page == "scene") {
  } else if (page == "code-editor") {
    selectors.codeEditorWrapper.classList.add("active");
    // clearPreview();
    document.querySelector("#code-editor").innerText = parse.htmlFromPreview();
  } else if (page == "export") {
    document.querySelector("#export-wrapper").classList.add("active");
    loadExportSection();
  } else if (page == "assets") {
    document.querySelector("#assets-explorer").classList.add("active");
    if (!assetsExplorerLoaded) {
      loadAssetsExplorer();
    }
  } else if (page == "templates") {
    document.querySelector("#templates").classList.add("active");
    if (!templatesLoaded) {
      loadTemplates();
    }
  }
}

function loadExportSection() {
  const code = parse.htmlFromPreview();
  document.querySelector("#export-code-view").innerText = code;
  document.querySelector("#export-copy").addEventListener("click", (e) => {
    copy(code);
    e.target.innerText = "✅ Copied";
    setTimeout(() => {
      e.target.innerText = "Copy";
    }, 2000);
  });
  document.querySelector('#export-download').addEventListener('click', () => {
    downloadFile('markfolio.md', code)
  })
}

function loadAssetsExplorer() {
  assetsExplorerLoaded = true;
  assets.forEach(item => {
    const name = item.match(/\/([^\/\s]+)\./g)?.pop()?.replace(/\//, '').slice(0, -1);
    const div = document.createElement('div');
    div.onclick = () => {copyAssetId(div)};
    div.oncontextmenu = (e) => {showContextMenu(e, 'asset', div)}
    div.innerHTML = `<img src="${item}" alt="${name}"><p>${name}</p>`;
    document.querySelector("#all-assets").appendChild(div);
  })
}

function loadTemplates() {
  templatesLoaded = true;
  clearInterval(saveInterval);
  saveData();
  sessionSave = selectors.preview.innerHTML;
  for (let i =0; i < templates.length; i++) {
    const div = document.createElement('div');
    // div.oncontextmenu = (e) => {showContextMenu(e, 'asset', div)}
    div.innerHTML = `<div>${i}</div><button onclick="previewTemplate('${i}')">Preview</button><button onclick="useTemplate('${i}')">Use</button>`;
    document.querySelector("#all-templates").appendChild(div);
  };
}

function useTemplate(num) {
  confirmBox(() => {
    render(templates[parseInt(num)], false);
    sessionSave = selectors.preview.innerHTML;
    saveData();
  }, 'This will delete all of your current work.')
}

function previewTemplate(num) {
  render(templates[parseInt(num)], false);
}

// Utility functions

function randomString(
  length,
  characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",
) {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function uuid() {
  return `MFOID-${Date.now().toString(36)}-${randomString(9).toUpperCase()}`;
}

function copy(content) {
  navigator.clipboard.writeText(content);
}

function isTextElement(element) {
  const textElements = [
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "P",
    "EM",
    "I",
    "STRONG",
    "B",
    "OL",
    "UL",
    "LI",
    "A",
    "BLOCKQUOTE",
  ];

  return textElements.includes(element.tagName.toUpperCase());
}

function cleanupPreview() {
  selectors.preview.querySelectorAll("*").forEach((e) => {
    if (
      !e.classList.contains("selected") &&
      isTextElement(e) &&
      (e.innerText === "" || e.textContent === "")
    ) {
      e.remove();
    }
  });
}

function downloadFile(name, content) {
  const blob = new Blob([content], { type: "text/plain" });

  const a = document.createElement("a");
  const url = window.URL.createObjectURL(blob);

  a.href = url;
  a.download = name;

  document.body.appendChild(a);
  a.click();

  window.URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function clearPreview() {
  confirmBox(() => {
    selectors.preview.innerHTML = '';
  })
}

function confirmBox(callback, text = '') {
  selectors.previewWrapper.classList.add('confirm');
  document.querySelector('#confirm-box').style.display = 'flex';
  document.querySelector('#confirm-box').innerHTML = `<div><p>Are you sure? ${text}</p><button class="no">No</button><button class="yes">Yes</button></div>`
  document.querySelector('#confirm-box .no').addEventListener('click', () => {
    selectors.previewWrapper.classList.remove('confirm');
    document.querySelector('#confirm-box').style.display = 'none';
  })
  document.querySelector('#confirm-box .yes').addEventListener('click', () => {
    selectors.previewWrapper.classList.remove('confirm');
    document.querySelector('#confirm-box').style.display = 'none';
    callback();
  })
}

function reloadPreview() {
  const html = selectors.preview.innerHTML;
  selectors.preview.innerHTML = "";
  setTimeout(() => {
    selectors.preview.innerHTML = html;
  }, 100);
}

function duplicateElement(node) {
  node.parentNode.insertBefore(node.cloneNode(true), node.nextSibling);
}

function removeElement(element) {
  element.remove();
  exitPropertiesEditor();
}

function render(content, add = true, elementName = "", ignoreRequired = false) {
  const html = parseMd(content, elementName, ignoreRequired)[0];
  if (html !== "MFO(R:1)") {
    selectors.preview.innerHTML = add
      ? selectors.preview.innerHTML + html
      : html;
  }
}

function saveCodeEditorChanges() {
  render(document.querySelector("#code-editor").innerText, false, "", true);
}

// Properties editor

function openPropertiesEditor(element) {
  document.querySelector(".properties-bottom .delete button").remove();
  document.querySelector(".properties-bottom .duplicate button").remove();
  document.querySelector(
    ".properties-bottom .delete",
  ).innerHTML = `<button>Delete</button>`;
  document.querySelector(
    ".properties-bottom .duplicate",
  ).innerHTML = `<button>Duplicate</button>`;
  document
    .querySelectorAll(".selected")
    .forEach((e) => e.classList.remove("selected"));
  element.classList.add("selected");
  selectors.properties.innerHTML = "";
  let html = "";
  selectors.propertiesEditor.classList.add("active");
  document
    .querySelector(".properties-bottom .delete button")
    .addEventListener("click", () => {
      removeElement(element);
    });
    document
    .querySelector(".properties-bottom .duplicate button")
    .addEventListener("click", () => {
      duplicateElement(element)
    });
  selectors.properties.innerHTML += `<p class="tag-name">Element: <span>${element.tagName}</span</p>`;
  if (element.innerText != "" || isTextElement(element)) {
    html += `<p class="label">Input</p>
    <textarea class="main-input" placeholder="Input">${element.innerText}</textarea>`;
    selectors.properties.innerHTML += html;
    const mfoid = element.className.match(/MFOID-(.*?)(?=\s|")/)?.[0] || "";
    selectors.properties
      .querySelector(".main-input")
      .addEventListener("input", (e) => {
        document.querySelector(`.${mfoid}`).innerText = e.target.value;
      });
  }

  if (element.getAttribute("data-srcv")) {
    const mfoid = element.className.match(/MFOID-(.*?)(?=\s|")/)?.[0] || "";
    const matches = [
      ...element
        .getAttribute("data-srcv")
        .matchAll(/MFO[{(](\w+)(?:,([^)]+))?[})]/g),
    ];
    matches.forEach((match) => {
      selectors.properties.innerHTML += `<p class="label">${match[2]}</p>
      <input class="SRCV-${mfoid}" placeholder="${match[2]}" value="${
        element.getAttribute(`data-${match[2]}`) || ""
      }">`;
      setTimeout(() => {
        selectors.properties
          .querySelector(`.SRCV-${mfoid}`)
          .addEventListener("input", (e) => {
            element.src = element
              .getAttribute("data-srcv")
              .replace(match[0], e.target.value);
            element.setAttribute(`data-${match[2]}`, e.target.value);
          });
      }, 10);
    });
  }

  if (element instanceof HTMLImageElement) {
    const mfoid = element.className.match(/MFOID-(.*?)(?=\s|")/)?.[0] || "";
    selectors.properties.innerHTML += `<p class="label">Source</p>
    <input class="SRC-${mfoid}" placeholder="Image source" value="${
      element.src || ""
    }">
    <p class="label">Alt</p>
    <input class="ALT-${mfoid}" placeholder="Alt text" value="${
      element.alt || ""
    }">
    <p class="label">Source from assets</p>
    <input class="SRCA-${mfoid}" placeholder="Example: markfolio" value="${
      element.getAttribute("data-asset") || ""
    }">`;
    selectors.properties
      .querySelector(`.SRC-${mfoid}`)
      .addEventListener("input", (e) => {
        document.querySelector(`.${mfoid}`).src = e.target.value;
      });
    selectors.properties
      .querySelector(`.SRCA-${mfoid}`)
      .addEventListener("input", (e) => {
        document.querySelector(`.${mfoid}`).src = assets[e.target.value];
        document
          .querySelector(`.${mfoid}`)
          .setAttribute("data-asset", e.target.value);
      });
    selectors.properties
      .querySelector(`.ALT-${mfoid}`)
      .addEventListener("input", (e) => {
        document.querySelector(`.${mfoid}`).alt = e.target.value;
      });
  }
}

function exitPropertiesEditor() {
  selectors.propertiesEditor.classList.remove("active");
  document
    .querySelectorAll(".selected")
    .forEach((e) => e.classList.remove("selected"));
}

// Search assets

document.querySelector("#assets-search").addEventListener("input", (input) => {
  document.querySelectorAll("#all-assets > div > p").forEach((asset) => {
    if (
      asset.innerText.toLowerCase().includes(input.target.value.toLowerCase())
    ) {
      asset.parentNode.style.display = "flex";
    } else {
      asset.parentNode.style.display = "none";
    }
  });
});

// Copy asset ID

function copyAssetId(node) {
  node.classList.add("c");
  copy(node.querySelector("p").innerText);
  setTimeout(() => {
    node.classList.remove("c");
  }, 2000);
}

// Search and load element buttons

function loadElements() {
  selectors.elementsList.innerHTML = '';
  for (let i = 0; i < Object.keys(elements).length; i++) {
    selectors.elementsList.innerHTML += `<li>${
      Object.keys(elements)[i]
    }<button onclick="addFromElements('${i}')">Add</button></li>`;
  }
}

loadElements()

document
  .querySelector("#search-elements input")
  .addEventListener("input", (e) => {
    selectors.elementsList.querySelectorAll("li").forEach((li) => {
      li.style.display = !li.innerText
        .toLowerCase()
        .includes(e.target.value.toLowerCase())
        ? "none"
        : "flex";
    });
  });

// Add from elements

function addFromElements(num) {
  render(
    Object.values(elements)[parseInt(num)],
    true,
    Object.keys(elements)[parseInt(num)],
  );
}

// Drag and drop

function dragClosestElement(y) {
  return [
    ...selectors.preview.querySelectorAll(".select:not(.dragging)"),
  ].reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { element: child };
      } else {
        return closest;
      }
    },
    { offset: Number.NEGATIVE_INFINITY },
  );
}

selectors.preview.addEventListener("dragover", (e) => {
  e.preventDefault();
  const closest = dragClosestElement(e.clientY);
  if (closest == null) {
    return;
  } else {
    selectors.preview.insertBefore(
      document.querySelector(".dragging"),
      closest.element,
    );
  }
});

// Mutation observer

new MutationObserver((list) => {
  list.forEach((mutation) => {
    if (mutation.type === "childList") {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          addEventsToElement(node);
        }
      });
    }
  });
}).observe(selectors.preview, { childList: true, subtree: true });

// Element events

function addEventsToElement(node) {
  node.addEventListener("contextmenu", (e) => {
    showContextMenu(e, "element", node);
  });
  node.addEventListener("click", (e) => {
    openPropertiesEditor(e.target);
  });
  node.addEventListener("dragstart", () => {
    node.classList.add("dragging");
  });
  node.addEventListener("dragend", () => {
    node.classList.remove("dragging");
  });
}

function elementsEventsReload() {
  selectors.preview.querySelector("*").forEach((e) => {
    addEventsToElement(e);
  });
}

// Document event listeners

document.onclick = () => {
  hideContextMenu();
};

document.oncontextmenu = (e) => {
  e.preventDefault();
};

document.addEventListener('keydown', function(event) {
  if ((event.ctrlKey || event.metaKey) && event.key === 's') {
    event.preventDefault();
    saveData();
  }
});


// Context menu

function showContextMenu(e, menuType, ...args) {
  e.preventDefault();
  const { clientX, clientY } = e;
  hideContextMenu();
  selectors.dump.innerHTML = contextMenus[menuType][0];
  menu = document.querySelector(`.${menuType}-context-menu`);
  menu.style.left =
    clientX + menu.scrollWidth >= window.innerWidth
      ? window.innerWidth - menu.scrollWidth - 20 + "px"
      : clientX + "px";
  menu.style.top =
    clientY + menu.scrollHeight >= window.innerHeight
      ? window.innerHeight - menu.scrollHeight - 20 + "px"
      : clientY + "px";
  contextMenus[menuType][1](menu, ...args);
}

function hideContextMenu() {
  if (document.querySelector(".context-menu")) {
    document
      .querySelectorAll(".cmenu-target")
      .forEach((e) => e.classList.remove("cmenu-target"));
    document.querySelector(".context-menu").remove();
  }
}

function htmlToMarkdown(str) {
  str = str.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, '$1')
  .replace(/<(\w+)\s*([^>]*)class\s*=\s*"[^"]*"\s*([^>]*)>/gi, '<$1 $2$3>')
  .replace(/<(\w+)\s*([^>]*)style\s*=\s*"[^"]*"\s*([^>]*)>/gi, '<$1 $2$3>')
  .replace(/<(\w+)\s*([^>]*)id\s*=\s*"[^"]*"\s*([^>]*)>/gi, '<$1 $2$3>')
  .replace(/<(\w+)\s*([^>]*)draggable\s*=\s*"[^"]*"\s*([^>]*)>/gi, '<$1 $2$3>')
  .replace(/<(\w+)\s*([^>]*)rel\s*=\s*"[^"]*"\s*([^>]*)>/gi, '<$1 $2$3>')
  .replace(/<(\w+)\s*([^>]*)target\s*=\s*"[^"]*"\s*([^>]*)>/gi, '<$1 $2$3>')
  .replaceAll('<pre ><code >', '<pre>')
  .replaceAll('</pre ></code >', '</pre>');
  const temp = document.createElement('div');
  temp.innerHTML = str;
  temp.querySelectorAll('*').forEach(node => {
    node.classList.add('mfo-conversion-id-' + randomString(12) + 'end');
  });
  const extemp = document.createElement('div');
  extemp.innerHTML = temp.innerHTML;
  
  function convert(node) {
    const i = node.innerHTML;
    const className = node.className.match(/mfo-conversion-id-(.*?)end/)[0];
  
    function set(text) {
      extemp.querySelector('.'+className).outerHTML = text;
    }

    if (node.hasAttribute('data-skip')) {
      return;
    }

    switch (node.tagName && node.tagName.toLowerCase()) {
      case 'h1':
      case 'h2':
      case 'h3':
      case 'h4':
      case 'h5':
      case 'h6':
        set(`${'#'.repeat(parseInt(node.tagName.charAt(1), 10))} ${i}\n`);
        break;

      case 'pre':
        set('\n```\n' + i + '\n```\n');
        break;

      case 'em':
        set(`*${i}*`);
        break;

      case 'a':
        set(`[${i}](${node.getAttribute('data-href')})`);
        break;

      case 'img':
        set(`![${node.getAttribute('alt')}](${node.getAttribute('src')})`);
        break;

      case 'code':
        set(`\`${i}\``);
        break;

      case 'strong':
        set(`**${i}**`);
        break;

      case 'br':
        set('\n');
        break;

      case 'hr':
        set('\n---\n');
        break;

      case 'blockquote':
        set(`> ${i.trim()}\n`);
        break;

      default:
        break;
    }
  }

  temp.querySelectorAll('*').forEach(node => {
    convert(node)
  });
  extemp.innerHTML = extemp.innerHTML.replace(/<(\w+)\s*([^>]*)class\s*=\s*"[^"]*"\s*([^>]*)>/gi, '<$1 $2$3>')
  return extemp.innerHTML.replaceAll('&gt;', '>');
}

console.log(htmlToMarkdown(document.querySelector('#preview').innerHTML))

render(`# Hey! Welcome to Markfolio!

Markfolio is a visual markdown editor.

Markfolio uses a modified version of showdownjs where I used some hacky ways to fix a lot of the bugs with showdownjs. You can drag and drop elements to change their position and right click to get some quick actions. Left click on an element to view the properties editor.

Icons in the asset explorer and template #0 are from profileme.dev

[Donate to keep the project alive!](https://patreon.com/axorax)`, false);
