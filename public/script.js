class FileManager {
    constructor() {
        this.currentPath = '';
        this.pathHistory = [];
        this.currentEditingFile = null;
        this.findMatches = [];
        this.currentMatchIndex = -1;
        this.currentView = 'files';
        this.init();
    }

    init() {
        this.bindEvents();
        this.loadFiles();
        this.initDashboard();
    }

    bindEvents() {
        // 返回按钮
        document.getElementById('back-btn').addEventListener('click', () => {
            this.goBack();
        });

        // 新建文件夹按钮
        document.getElementById('new-folder-btn').addEventListener('click', () => {
            this.showNewFolderModal();
        });

        // 新建文件按钮
        document.getElementById('new-file-btn').addEventListener('click', () => {
            this.showNewFileModal();
        });

        // 上传文件按钮
        document.getElementById('upload-btn').addEventListener('click', () => {
            document.getElementById('file-input').click();
        });

        // 文件选择
        document.getElementById('file-input').addEventListener('change', (e) => {
            this.uploadFiles(e.target.files);
        });

        // 创建文件夹确认
        document.getElementById('create-folder-btn').addEventListener('click', () => {
            this.createFolder();
        });

        // 创建文件确认
        document.getElementById('create-file-btn').addEventListener('click', () => {
            this.createFile();
        });

        // 删除确认
        document.getElementById('confirm-delete-btn').addEventListener('click', () => {
            this.confirmDelete();
        });

        // 文件夹名称输入框回车
        document.getElementById('folder-name-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createFolder();
            }
        });

        // 文件名称输入框回车
        document.getElementById('file-name-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.createFile();
            }
        });

        // 文件编辑器相关事件
        document.getElementById('save-file-btn').addEventListener('click', () => {
            this.saveFile();
        });

        document.getElementById('save-as-btn').addEventListener('click', () => {
            this.saveAsFile();
        });

        // 文件内容编辑器变化事件
        document.getElementById('file-content-editor').addEventListener('input', () => {
            this.updateEditorStats();
        });

        // 查找替换相关事件
        document.getElementById('find-replace-btn').addEventListener('click', () => {
            this.toggleFindReplacePanel();
        });

        document.getElementById('close-find-replace').addEventListener('click', () => {
            this.closeFindReplacePanel();
        });

        document.getElementById('find-input').addEventListener('input', () => {
            this.performFind();
        });

        document.getElementById('find-prev-btn').addEventListener('click', () => {
            this.findPrevious();
        });

        document.getElementById('find-next-btn').addEventListener('click', () => {
            this.findNext();
        });

        document.getElementById('replace-btn').addEventListener('click', () => {
            this.replaceCurrentMatch();
        });

        document.getElementById('replace-all-btn').addEventListener('click', () => {
            this.replaceAll();
        });

        document.getElementById('case-sensitive-cb').addEventListener('change', () => {
            this.performFind();
        });

        document.getElementById('whole-word-cb').addEventListener('change', () => {
            this.performFind();
        });

        // 编辑器快捷键
        document.getElementById('file-content-editor').addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'f') {
                e.preventDefault();
                this.toggleFindReplacePanel();
            }
            if (e.key === 'Escape') {
                this.closeFindReplacePanel();
            }
        });

        // 点击模态框外部关闭
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal')) {
                this.closeModal(e.target.id);
            }
        });

        // Tab切换事件
        document.getElementById('files-tab').addEventListener('click', () => {
            this.switchView('files');
        });

        document.getElementById('dashboard-tab').addEventListener('click', () => {
            this.switchView('dashboard');
        });

        // Dashboard刷新按钮
        document.getElementById('refresh-dashboard').addEventListener('click', () => {
            this.loadDashboardData();
        });
    }

    async loadFiles(path = '') {
        try {
            this.showLoading();
            const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '加载文件失败');
            }

            this.currentPath = data.currentPath;
            this.updatePathDisplay();
            this.updateBackButton();
            this.renderFiles(data.items);
        } catch (error) {
            console.error('加载文件错误:', error);
            this.showMessage('加载文件失败: ' + error.message, 'error');
            this.showEmpty('加载失败');
        }
    }

    renderFiles(items) {
        const fileGrid = document.getElementById('file-grid');
        
        if (items.length === 0) {
            this.showEmpty('此文件夹为空');
            return;
        }

        fileGrid.innerHTML = items.map(item => this.createFileItem(item)).join('');

        // 绑定文件项点击事件
        fileGrid.querySelectorAll('.file-item').forEach(element => {
            const path = element.dataset.path;
            const isDirectory = element.dataset.isDirectory === 'true';

            element.addEventListener('click', (e) => {
                if (e.target.classList.contains('action-btn') || e.target.closest('.action-btn')) {
                    return; // 如果点击的是操作按钮，不执行文件夹导航
                }
                
                if (isDirectory) {
                    this.navigateToFolder(path);
                } else if (this.isEditableFile(element.dataset.name)) {
                    // 如果是可编辑文件，双击打开编辑器
                    this.editFile(path);
                }
            });
        });

        // 绑定操作按钮事件
        this.bindFileActions();
    }

    createFileItem(item) {
        const isDirectory = item.isDirectory;
        const iconClass = isDirectory ? 'fas fa-folder' : this.getFileIcon(item.name);
        const sizeText = isDirectory ? '文件夹' : this.formatFileSize(item.size);
        const date = new Date(item.lastModified).toLocaleString('zh-CN');
        const isEditable = this.isEditableFile(item.name);

        return `
            <div class="file-item ${isDirectory ? 'folder' : 'file'}"
                 data-path="${item.path}"
                 data-is-directory="${isDirectory}"
                 data-name="${item.name}">
                <div class="file-actions">
                    ${!isDirectory ? `
                        ${isEditable ? `
                            <button class="action-btn edit" onclick="fileManager.editFile('${item.path}')" title="编辑">
                                <i class="fas fa-edit"></i>
                            </button>
                        ` : ''}
                        <button class="action-btn download" onclick="fileManager.downloadFile('${item.path}')" title="下载">
                            <i class="fas fa-download"></i>
                        </button>
                        <button class="action-btn copy-url" onclick="fileManager.copyDownloadUrl('${item.path}')" title="复制下载链接">
                            <i class="fas fa-copy"></i>
                        </button>
                    ` : ''}
                    <button class="action-btn delete" onclick="fileManager.showDeleteModal('${item.path}', '${item.name}')" title="删除">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
                <div class="file-icon ${isDirectory ? 'folder' : 'file'}">
                    <i class="${iconClass}"></i>
                </div>
                <div class="file-name">${item.name}</div>
                <div class="file-info">
                    <div>${sizeText}</div>
                    <div>${date}</div>
                </div>
            </div>
        `;
    }

    getFileIcon(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const iconMap = {
            'txt': 'fas fa-file-alt',
            'doc': 'fas fa-file-word',
            'docx': 'fas fa-file-word',
            'pdf': 'fas fa-file-pdf',
            'xls': 'fas fa-file-excel',
            'xlsx': 'fas fa-file-excel',
            'ppt': 'fas fa-file-powerpoint',
            'pptx': 'fas fa-file-powerpoint',
            'jpg': 'fas fa-file-image',
            'jpeg': 'fas fa-file-image',
            'png': 'fas fa-file-image',
            'gif': 'fas fa-file-image',
            'mp4': 'fas fa-file-video',
            'avi': 'fas fa-file-video',
            'mov': 'fas fa-file-video',
            'mp3': 'fas fa-file-audio',
            'wav': 'fas fa-file-audio',
            'zip': 'fas fa-file-archive',
            'rar': 'fas fa-file-archive',
            '7z': 'fas fa-file-archive',
            'js': 'fas fa-file-code',
            'html': 'fas fa-file-code',
            'css': 'fas fa-file-code',
            'php': 'fas fa-file-code',
            'py': 'fas fa-file-code',
            'json': 'fas fa-file-code',
            'xml': 'fas fa-file-code',
            'csv': 'fas fa-file-csv',
            'tsv': 'fas fa-file-csv',
            'md': 'fas fa-file-alt',
            'yaml': 'fas fa-file-code',
            'yml': 'fas fa-file-code'
        };
        return iconMap[extension] || 'fas fa-file';
    }

    isEditableFile(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        const editableExtensions = ['txt', 'json', 'csv', 'tsv', 'xml', 'html', 'css', 'js', 'md', 'yaml', 'yml', 'ini', 'conf', 'log'];
        return editableExtensions.includes(extension) || !extension;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    bindFileActions() {
        // 操作按钮事件已在HTML中通过onclick绑定
    }

    navigateToFolder(path) {
        this.pathHistory.push(this.currentPath);
        this.loadFiles(path);
    }

    goBack() {
        if (this.pathHistory.length > 0) {
            const previousPath = this.pathHistory.pop();
            this.loadFiles(previousPath);
        }
    }

    updatePathDisplay() {
        const pathElement = document.getElementById('current-path');
        pathElement.textContent = this.currentPath || '/';
    }

    updateBackButton() {
        const backBtn = document.getElementById('back-btn');
        backBtn.disabled = this.pathHistory.length === 0;
    }

    showLoading() {
        const fileGrid = document.getElementById('file-grid');
        fileGrid.innerHTML = '<div class="loading" id="loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
    }

    showEmpty(message = '此文件夹为空') {
        const fileGrid = document.getElementById('file-grid');
        fileGrid.innerHTML = `
            <div class="empty">
                <i class="fas fa-folder-open"></i>
                <div>${message}</div>
            </div>
        `;
    }

    // 新建文件夹
    showNewFolderModal() {
        const modal = document.getElementById('new-folder-modal');
        const input = document.getElementById('folder-name-input');
        input.value = '';
        modal.classList.add('show');
        setTimeout(() => input.focus(), 100);
    }

    // 新建文件
    showNewFileModal() {
        const modal = document.getElementById('new-file-modal');
        const input = document.getElementById('file-name-input');
        input.value = '';
        modal.classList.add('show');
        setTimeout(() => input.focus(), 100);
    }

    async createFolder() {
        const input = document.getElementById('folder-name-input');
        const name = input.value.trim();

        if (!name) {
            this.showMessage('请输入文件夹名称', 'error');
            return;
        }

        try {
            const response = await fetch('/api/mkdir', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    path: this.currentPath,
                    name: name
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '创建文件夹失败');
            }

            this.closeModal('new-folder-modal');
            this.showMessage('文件夹创建成功', 'success');
            this.loadFiles(this.currentPath);
        } catch (error) {
            console.error('创建文件夹错误:', error);
            this.showMessage('创建文件夹失败: ' + error.message, 'error');
        }
    }

    async createFile() {
        const input = document.getElementById('file-name-input');
        const name = input.value.trim();

        if (!name) {
            this.showMessage('请输入文件名称', 'error');
            return;
        }

        // 验证文件扩展名
        const extension = name.split('.').pop().toLowerCase();
        const editableExtensions = ['txt', 'json', 'csv', 'tsv', 'xml', 'html', 'css', 'js', 'md', 'yaml', 'yml', 'ini', 'conf', 'log'];
        
        if (extension && !editableExtensions.includes(extension)) {
            this.showMessage('不支持创建此类型的文件', 'error');
            return;
        }

        try {
            const response = await fetch('/api/create-file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    path: this.currentPath,
                    name: name,
                    content: ''
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '创建文件失败');
            }

            this.closeModal('new-file-modal');
            this.showMessage('文件创建成功', 'success');
            this.loadFiles(this.currentPath);
        } catch (error) {
            console.error('创建文件错误:', error);
            this.showMessage('创建文件失败: ' + error.message, 'error');
        }
    }

    // 文件上传
    async uploadFiles(files) {
        if (files.length === 0) return;

        for (const file of files) {
            await this.uploadSingleFile(file);
        }

        // 重新加载文件列表
        this.loadFiles(this.currentPath);
    }

    async uploadSingleFile(file) {
        try {
            const formData = new FormData();
            formData.append('file', file);

            // 使用查询参数传递路径
            const uploadUrl = `/api/upload?path=${encodeURIComponent(this.currentPath)}`;
            
            const response = await fetch(uploadUrl, {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '上传失败');
            }

            this.showMessage(`文件 "${file.name}" 上传成功`, 'success');
        } catch (error) {
            console.error('文件上传错误:', error);
            this.showMessage(`文件 "${file.name}" 上传失败: ${error.message}`, 'error');
        }
    }

    // 文件下载
    downloadFile(path) {
        const downloadUrl = `/api/download/${path}`;
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = '';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }

    // 复制下载链接
    copyDownloadUrl(path) {
        const baseUrl = window.location.origin;
        const downloadUrl = `${baseUrl}/api/download/${path}`;
        
        // 使用现代浏览器的剪贴板API
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(downloadUrl).then(() => {
                this.showMessage('下载链接已复制到剪贴板', 'success');
            }).catch(err => {
                console.error('复制失败:', err);
                this.fallbackCopyTextToClipboard(downloadUrl);
            });
        } else {
            // 降级方案
            this.fallbackCopyTextToClipboard(downloadUrl);
        }
    }

    // 降级复制方案
    fallbackCopyTextToClipboard(text) {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        
        // 避免滚动到底部
        textArea.style.top = "0";
        textArea.style.left = "0";
        textArea.style.position = "fixed";
        textArea.style.opacity = "0";
        
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            const successful = document.execCommand('copy');
            if (successful) {
                this.showMessage('下载链接已复制到剪贴板', 'success');
            } else {
                this.showMessage('复制失败，请手动复制链接', 'error');
            }
        } catch (err) {
            console.error('降级复制失败:', err);
            this.showMessage('复制失败，请手动复制链接', 'error');
        }
        
        document.body.removeChild(textArea);
    }

    // 删除文件/文件夹
    showDeleteModal(path, name) {
        const modal = document.getElementById('delete-modal');
        const nameElement = document.getElementById('delete-item-name');
        nameElement.textContent = name;
        modal.dataset.deletePath = path;
        modal.classList.add('show');
    }

    async confirmDelete() {
        const modal = document.getElementById('delete-modal');
        const path = modal.dataset.deletePath;

        try {
            const response = await fetch(`/api/delete/${path}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '删除失败');
            }

            this.closeModal('delete-modal');
            this.showMessage('删除成功', 'success');
            this.loadFiles(this.currentPath);
        } catch (error) {
            console.error('删除错误:', error);
            this.showMessage('删除失败: ' + error.message, 'error');
        }
    }

    // 模态框管理
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        modal.classList.remove('show');
    }

    // 文件编辑功能
    async editFile(filePath) {
        try {
            this.showMessage('正在加载文件...', 'info');
            
            const response = await fetch(`/api/edit/${filePath}`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '读取文件失败');
            }

            this.currentEditingFile = {
                path: filePath,
                filename: data.filename,
                originalContent: data.content
            };

            // 显示编辑器
            const modal = document.getElementById('file-editor-modal');
            const filenameElement = document.getElementById('editor-filename');
            const editor = document.getElementById('file-content-editor');

            filenameElement.textContent = data.filename;
            editor.value = data.content;
            modal.classList.add('show');

            this.updateEditorStats();
            setTimeout(() => editor.focus(), 100);

        } catch (error) {
            console.error('编辑文件错误:', error);
            this.showMessage('打开文件失败: ' + error.message, 'error');
        }
    }

    async saveFile() {
        if (!this.currentEditingFile) {
            this.showMessage('没有正在编辑的文件', 'error');
            return;
        }

        try {
            const editor = document.getElementById('file-content-editor');
            const content = editor.value;

            const response = await fetch(`/api/edit/${this.currentEditingFile.path}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    content: content
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '保存文件失败');
            }

            this.currentEditingFile.originalContent = content;
            this.showMessage('文件保存成功', 'success');

        } catch (error) {
            console.error('保存文件错误:', error);
            this.showMessage('保存文件失败: ' + error.message, 'error');
        }
    }

    async saveAsFile() {
        if (!this.currentEditingFile) {
            this.showMessage('没有正在编辑的文件', 'error');
            return;
        }

        const newName = prompt('请输入新的文件名:', this.currentEditingFile.filename);
        if (!newName) return;

        try {
            const editor = document.getElementById('file-content-editor');
            const content = editor.value;

            const response = await fetch('/api/create-file', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    path: this.currentPath,
                    name: newName,
                    content: content
                })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || '另存为失败');
            }

            this.showMessage('文件另存为成功', 'success');
            this.loadFiles(this.currentPath);

        } catch (error) {
            console.error('另存为错误:', error);
            this.showMessage('另存为失败: ' + error.message, 'error');
        }
    }

    closeEditor() {
        const editor = document.getElementById('file-content-editor');
        const hasChanges = this.currentEditingFile && 
                          editor.value !== this.currentEditingFile.originalContent;

        if (hasChanges) {
            const confirmed = confirm('文件有未保存的更改，确定要关闭吗？');
            if (!confirmed) return;
        }

        this.closeModal('file-editor-modal');
        this.currentEditingFile = null;
    }

    updateEditorStats() {
        const editor = document.getElementById('file-content-editor');
        const content = editor.value;
        
        const lines = content.split('\n').length;
        const chars = content.length;
        
        document.getElementById('line-count').textContent = lines;
        document.getElementById('char-count').textContent = chars;
    }

    // 查找替换功能
    toggleFindReplacePanel() {
        const panel = document.getElementById('find-replace-panel');
        const isVisible = panel.style.display !== 'none';
        
        if (isVisible) {
            this.closeFindReplacePanel();
        } else {
            panel.style.display = 'block';
            const findInput = document.getElementById('find-input');
            findInput.focus();
            
            // 如果编辑器中有选中的文本，自动填入查找框
            const editor = document.getElementById('file-content-editor');
            const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
            if (selectedText) {
                findInput.value = selectedText;
                this.performFind();
            }
        }
    }

    closeFindReplacePanel() {
        const panel = document.getElementById('find-replace-panel');
        panel.style.display = 'none';
        this.clearHighlights();
        this.findMatches = [];
        this.currentMatchIndex = -1;
        
        // 清空输入框
        document.getElementById('find-input').value = '';
        document.getElementById('replace-input').value = '';
        document.getElementById('find-status').textContent = '';
    }

    performFind() {
        const findText = document.getElementById('find-input').value;
        const editor = document.getElementById('file-content-editor');
        const content = editor.value;
        
        this.clearHighlights();
        this.findMatches = [];
        this.currentMatchIndex = -1;
        
        if (!findText) {
            document.getElementById('find-status').textContent = '';
            return;
        }

        const caseSensitive = document.getElementById('case-sensitive-cb').checked;
        const wholeWord = document.getElementById('whole-word-cb').checked;
        
        let searchContent = content;
        let searchText = findText;
        
        if (!caseSensitive) {
            searchContent = content.toLowerCase();
            searchText = findText.toLowerCase();
        }

        let index = 0;
        while (true) {
            let foundIndex = searchContent.indexOf(searchText, index);
            if (foundIndex === -1) break;
            
            // 检查全词匹配
            if (wholeWord) {
                const beforeChar = foundIndex > 0 ? content[foundIndex - 1] : '';
                const afterChar = foundIndex + findText.length < content.length ? 
                    content[foundIndex + findText.length] : '';
                
                const isWordBoundary = (char) => /\W/.test(char) || char === '';
                
                if (!isWordBoundary(beforeChar) || !isWordBoundary(afterChar)) {
                    index = foundIndex + 1;
                    continue;
                }
            }
            
            this.findMatches.push({
                start: foundIndex,
                end: foundIndex + findText.length
            });
            
            index = foundIndex + 1;
        }

        this.updateFindStatus();
        
        if (this.findMatches.length > 0) {
            this.currentMatchIndex = 0;
            this.highlightMatches();
            this.scrollToCurrentMatch();
        }
    }

    findNext() {
        if (this.findMatches.length === 0) return;
        
        this.currentMatchIndex = (this.currentMatchIndex + 1) % this.findMatches.length;
        this.highlightMatches();
        this.scrollToCurrentMatch();
        this.updateFindStatus();
    }

    findPrevious() {
        if (this.findMatches.length === 0) return;
        
        this.currentMatchIndex = this.currentMatchIndex <= 0 ? 
            this.findMatches.length - 1 : this.currentMatchIndex - 1;
        this.highlightMatches();
        this.scrollToCurrentMatch();
        this.updateFindStatus();
    }

    replaceCurrentMatch() {
        if (this.findMatches.length === 0 || this.currentMatchIndex === -1) {
            this.showMessage('没有找到要替换的内容', 'warning');
            return;
        }

        const replaceText = document.getElementById('replace-input').value;
        const editor = document.getElementById('file-content-editor');
        const currentMatch = this.findMatches[this.currentMatchIndex];
        
        // 执行替换
        const content = editor.value;
        const newContent = content.substring(0, currentMatch.start) + 
                          replaceText + 
                          content.substring(currentMatch.end);
        
        editor.value = newContent;
        
        // 重新查找以更新匹配位置
        const findText = document.getElementById('find-input').value;
        if (findText) {
            this.performFind();
        }
        
        this.updateEditorStats();
        this.showMessage('替换成功', 'success');
    }

    replaceAll() {
        if (this.findMatches.length === 0) {
            this.showMessage('没有找到要替换的内容', 'warning');
            return;
        }

        const replaceText = document.getElementById('replace-input').value;
        const findText = document.getElementById('find-input').value;
        const editor = document.getElementById('file-content-editor');
        
        const caseSensitive = document.getElementById('case-sensitive-cb').checked;
        const wholeWord = document.getElementById('whole-word-cb').checked;
        
        let content = editor.value;
        let flags = 'g';
        if (!caseSensitive) flags += 'i';
        
        let regex;
        if (wholeWord) {
            const escapedFind = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(`\\b${escapedFind}\\b`, flags);
        } else {
            const escapedFind = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            regex = new RegExp(escapedFind, flags);
        }
        
        const replacedContent = content.replace(regex, replaceText);
        const replaceCount = (content.match(regex) || []).length;
        
        editor.value = replacedContent;
        this.updateEditorStats();
        
        // 清除高亮并重新查找
        this.clearHighlights();
        this.findMatches = [];
        this.currentMatchIndex = -1;
        this.performFind();
        
        this.showMessage(`成功替换 ${replaceCount} 处`, 'success');
    }

    highlightMatches() {
        // 注意：这是一个简化的高亮实现
        // 在真实的编辑器中，通常需要更复杂的文本高亮逻辑
        this.updateFindStatus();
    }

    clearHighlights() {
        // 清除高亮的简化实现
        // 实际应用中可能需要移除DOM中的高亮元素
    }

    scrollToCurrentMatch() {
        if (this.currentMatchIndex === -1 || this.findMatches.length === 0) return;
        
        const editor = document.getElementById('file-content-editor');
        const currentMatch = this.findMatches[this.currentMatchIndex];
        
        // 设置光标位置到当前匹配
        editor.selectionStart = currentMatch.start;
        editor.selectionEnd = currentMatch.end;
        editor.focus();
        
        // 滚动到可见位置
        const lineHeight = 20; // 估算的行高
        const lines = editor.value.substring(0, currentMatch.start).split('\n').length;
        const scrollTop = Math.max(0, (lines - 5) * lineHeight);
        editor.scrollTop = scrollTop;
    }

    updateFindStatus() {
        const statusElement = document.getElementById('find-status');
        
        if (this.findMatches.length === 0) {
            statusElement.textContent = '未找到';
            statusElement.style.color = '#dc3545';
        } else {
            statusElement.textContent = `${this.currentMatchIndex + 1} / ${this.findMatches.length}`;
            statusElement.style.color = '#28a745';
        }
    }

    // 消息提示
    showMessage(message, type = 'info') {
        const container = document.getElementById('message-container');
        const messageElement = document.createElement('div');
        messageElement.className = `message ${type}`;
        
        const iconMap = {
            success: 'fas fa-check-circle',
            error: 'fas fa-exclamation-circle',
            info: 'fas fa-info-circle'
        };

        messageElement.innerHTML = `
            <i class="${iconMap[type]}"></i>
            ${message}
        `;

        container.appendChild(messageElement);

        // 3秒后自动移除
        setTimeout(() => {
            if (messageElement.parentNode) {
                messageElement.remove();
            }
        }, 3000);
    }

    // Dashboard 功能
    initDashboard() {
        // 如果当前在dashboard视图，加载数据
        if (this.currentView === 'dashboard') {
            this.loadDashboardData();
        }
    }

    switchView(view) {
        this.currentView = view;
        
        // 更新tab状态
        document.querySelectorAll('.tab-btn').forEach(tab => {
            tab.classList.remove('active');
        });
        document.getElementById(`${view}-tab`).classList.add('active');

        // 更新视图显示
        document.querySelectorAll('.view').forEach(viewElement => {
            viewElement.classList.remove('active');
        });
        
        if (view === 'files') {
            document.getElementById('file-manager-view').classList.add('active');
            document.getElementById('file-toolbar').style.display = 'flex';
        } else if (view === 'dashboard') {
            document.getElementById('dashboard-view').classList.add('active');
            document.getElementById('file-toolbar').style.display = 'none';
            this.loadDashboardData();
        }
    }

    async loadDashboardData() {
        try {
            this.showDashboardLoading();
            
            // 并行请求数据
            const [overviewResponse, statsResponse] = await Promise.all([
                fetch('/api/dashboard/overview'),
                fetch('/api/dashboard/stats')
            ]);

            if (!overviewResponse.ok || !statsResponse.ok) {
                throw new Error('加载数据失败');
            }

            const overviewData = await overviewResponse.json();
            const statsData = await statsResponse.json();

            this.renderDashboardOverview(overviewData);
            this.renderPlatformStats(overviewData.platformStats);
            this.renderFileStats(statsData);

        } catch (error) {
            console.error('加载Dashboard数据错误:', error);
            this.showMessage('加载统计数据失败: ' + error.message, 'error');
            this.showDashboardError();
        }
    }

    showDashboardLoading() {
        const overview = document.getElementById('stats-overview');
        const platformStats = document.getElementById('platform-stats');
        const fileStats = document.getElementById('file-stats');

        overview.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载统计数据...</div>';
        platformStats.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
        fileStats.innerHTML = '<div class="loading"><i class="fas fa-spinner fa-spin"></i> 加载中...</div>';
    }

    showDashboardError() {
        const overview = document.getElementById('stats-overview');
        const platformStats = document.getElementById('platform-stats');
        const fileStats = document.getElementById('file-stats');

        overview.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-triangle"></i>加载失败</div>';
        platformStats.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-triangle"></i>加载失败</div>';
        fileStats.innerHTML = '<div class="no-data"><i class="fas fa-exclamation-triangle"></i>加载失败</div>';
    }

    renderDashboardOverview(data) {
        const overview = document.getElementById('stats-overview');
        
        overview.innerHTML = `
            <div class="overview-title">KOSMOS 下载统计</div>
            <div class="overview-subtitle">版本 ${data.version} • 发布日期: ${data.releaseDate ? new Date(data.releaseDate).toLocaleDateString('zh-CN') : '未知'}</div>
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number">${data.totalDownloads}</div>
                    <div class="stat-label">总下载量</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${Object.keys(data.platformStats).length}</div>
                    <div class="stat-label">支持平台</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${Object.values(data.platformStats).reduce((total, platform) => total + platform.files.length, 0)}</div>
                    <div class="stat-label">可下载文件</div>
                </div>
            </div>
        `;
    }

    renderPlatformStats(platformStats) {
        const container = document.getElementById('platform-stats');
        
        if (Object.keys(platformStats).length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-chart-bar"></i>暂无下载数据</div>';
            return;
        }

        const platformNames = {
            'darwin-arm64': { name: 'macOS (Apple Silicon)', icon: '🍎' },
            'darwin-x64': { name: 'macOS (Intel)', icon: '🍎' },
            'win32-arm64': { name: 'Windows (ARM64)', icon: '🪟' },
            'win32-x64': { name: 'Windows (x64)', icon: '🪟' },
            'linux-x64': { name: 'Linux (x64)', icon: '🐧' },
            'unknown': { name: '其他', icon: '❓' }
        };

        const platformsArray = Object.entries(platformStats).sort((a, b) => b[1].count - a[1].count);

        container.innerHTML = platformsArray.map(([platform, data]) => {
            const platformInfo = platformNames[platform] || platformNames['unknown'];
            return `
                <div class="platform-item">
                    <div class="platform-name">
                        <span class="platform-icon">${platformInfo.icon}</span>
                        ${platformInfo.name}
                    </div>
                    <div class="platform-downloads">${data.count}</div>
                </div>
            `;
        }).join('');
    }

    renderFileStats(statsData) {
        const container = document.getElementById('file-stats');
        
        if (Object.keys(statsData).length === 0) {
            container.innerHTML = '<div class="no-data"><i class="fas fa-file"></i>暂无文件下载记录</div>';
            return;
        }

        const filesArray = Object.entries(statsData).sort((a, b) => b[1].count - a[1].count);

        container.innerHTML = filesArray.map(([filePath, data]) => {
            const fileName = filePath.split('/').pop();
            const lastDownload = data.lastDownload ? new Date(data.lastDownload).toLocaleString('zh-CN') : '从未下载';
            
            return `
                <div class="file-item-stat">
                    <div class="file-name-stat">
                        ${fileName}
                        <span class="file-path">${filePath}</span>
                    </div>
                    <div class="file-downloads">${data.count}</div>
                    <div class="file-meta">
                        最后下载:<br>
                        ${lastDownload}
                    </div>
                </div>
            `;
        }).join('');
    }
}

// 全局变量用于在HTML中调用
let fileManager;

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    fileManager = new FileManager();
});

// 全局函数用于HTML中调用
function closeModal(modalId) {
    fileManager.closeModal(modalId);
}