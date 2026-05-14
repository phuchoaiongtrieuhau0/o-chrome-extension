const manifest = chrome.runtime.getManifest();
document.getElementById('info').textContent = `Extension v${manifest.version} — Side Panel ready`;
