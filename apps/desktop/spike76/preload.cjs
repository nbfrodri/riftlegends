const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("draft", {
	read: () => ipcRenderer.invoke("draft"),
	advance: (ordinal) => ipcRenderer.invoke("draft", ordinal),
});
