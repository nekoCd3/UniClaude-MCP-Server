// ADB File Explorer
class AdbFileExplorer {
  constructor() {
    this.pathInput = document.getElementById('adbFsPath');
    this.refreshButton = document.getElementById('adbRefreshFs');
    this.fileTree = document.getElementById('adbFileTree');
    this.deviceSelect = document.getElementById('adbDeviceSelect');

    this.init();
  }

  init() {
    this.refreshButton.addEventListener('click', () => this.refreshFiles());
    this.pathInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.refreshFiles();
    });
  }

  async refreshFiles() {
    const deviceId = this.deviceSelect.value;
    const path = this.pathInput.value.trim();

    if (!deviceId) {
      this.fileTree.innerHTML = '<div class="status-line">Select a device first</div>';
      return;
    }

    this.fileTree.innerHTML = '<div class="status-line">Loading...</div>';

    try {
      const response = await fetch(`/api/devices/${deviceId}/fs?path=${encodeURIComponent(path)}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      this.renderFileTree(data.entries, data.path);
    } catch (error) {
      this.fileTree.innerHTML = `<div class="status-line">Error: ${error.message}</div>`;
    }
  }

  renderFileTree(entries, currentPath) {
    this.fileTree.innerHTML = '';

    if (currentPath !== '/') {
      const upButton = document.createElement('div');
      upButton.className = 'file-row directory';
      upButton.innerHTML = '<span class="file-name">..</span><span>Parent directory</span>';
      upButton.addEventListener('click', () => {
        const parentPath = currentPath.split('/').slice(0, -1).join('/') || '/';
        this.pathInput.value = parentPath;
        this.refreshFiles();
      });
      this.fileTree.appendChild(upButton);
    }

    entries.forEach(entry => {
      const row = document.createElement('div');
      row.className = `file-row ${entry.isDirectory ? 'directory' : 'file'}`;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'file-name';
      nameSpan.textContent = entry.name;

      const infoSpan = document.createElement('span');
      if (entry.isDirectory) {
        infoSpan.textContent = 'Directory';
      } else {
        infoSpan.textContent = this.formatFileSize(entry.size);
      }

      row.appendChild(nameSpan);
      row.appendChild(infoSpan);

      if (entry.isDirectory) {
        row.addEventListener('click', () => {
          this.pathInput.value = entry.path;
          this.refreshFiles();
        });
      }

      this.fileTree.appendChild(row);
    });
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new AdbFileExplorer();
});