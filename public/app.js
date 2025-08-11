// 全局变量
let currentPath = '';
let editingFilePath = '';

// DOM元素
const fileList = document.getElementById('fileList');
const loading = document.getElementById('loading');
const breadcrumbPath = document.getElementById('breadcrumbPath');
const messageContainer = document.getElementById('messageContainer');

// 模态框元素
const uploadModal = document.getElementById('uploadModal');
const folderModal = document.getElementById('folderModal');
const fileModal = document.getElementById('fileModal');
const editModal = document.getElementById('editModal');
const dashboardModal = document.getElementById('dashboardModal');
const deleteModal = document.getElementById('deleteModal');

// 初始化应用
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    bindEvents();
    loadFileList();
});

function initializeApp() {
    console.log('文件管理器初始化完成');
}

// 绑定事件监听器
function bindEvents() {
    // 头部按钮事件
    document.getElementById('uploadBtn').addEventListener('click', () => showModal(uploadModal));
    document.getElementById('newFolderBtn').addEventListener('click', () => showModal(folderModal));
    document.getElementById('newFileBtn').addEventListener('click', () => showModal(fileModal));
    document.getElementById('dashboardBtn').addEventListener('click', () => {
        showModal(dashboardModal);
        loadDashboard();
    });

    // 模态框关闭事件
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            hideModal(modal);
        });
    });

    // 点击模态框外部关闭
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                hideModal(modal);
            }
        });
    });

    // 文件上传相关事件
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('drop', handleFileDrop);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    fileInput.addEventListener('change', handleFileSelect);

    // 文件夹创建事件
    document.getElementById('createFolderBtn').addEventListener('click', createFolder);
    document.getElementById('cancelFolderBtn').addEventListener('click', () => hideModal(folderModal));
    document.getElementById('folderName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createFolder();
    });

    // 文件创建事件
    document.getElementById('createFileBtn').addEventListener('click', createFile);
    document.getElementById('cancelFileBtn').addEventListener('click', () => hideModal(fileModal));
    document.getElementById('fileName').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createFile();
    });

    // 文件编辑事件
    document.getElementById('saveFileBtn').addEventListener('click', saveFile);
    document.getElementById('cancelEditBtn').addEventListener('click', () => hideModal(editModal));

    // 删除确认事件
    document.getElementById('confirmDeleteBtn').addEventListener('click', confirmDelete);
    document.getElementById('cancelDeleteBtn').addEventListener('click', () => hideModal(deleteModal));
    document.getElementById('closeDelete').addEventListener('click', () => hideModal(deleteModal));
}

// 模态框显示/隐藏
function showModal(modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
}

function hideModal(modal) {
    modal.classList.remove('show');
    document.body.style.overflow = 'auto';
    
    // 重置表单
    const inputs = modal.querySelectorAll('input, textarea');
    inputs.forEach(input => input.value = '');
    
    // 重置上传进度
    const uploadProgress = document.getElementById('uploadProgress');
    if (uploadProgress) {
        uploadProgress.style.display = 'none';
        document.getElementById('progressFill').style.width = '0%';
        document.getElementById('progressText').textContent = '0%';
    }
}

// 加载文件列表
async function loadFileList(path = '') {
    showLoading(true);
    
    try {
        const response = await fetch(`/api/files?path=${encodeURIComponent(path)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        currentPath = data.currentPath;
        
        displayFileList(data.items);
        updateBreadcrumb(currentPath);
    } catch (error) {
        console.error('加载文件列表失败:', error);
        showMessage('加载文件列表失败: ' + error.message, 'error');
        displayEmptyState('加载失败');
    } finally {
        showLoading(false);
    }
}

// 显示文件列表
function displayFileList(items) {
    if (!items || items.length === 0) {
        displayEmptyState('此目录为空');
        return;
    }

    fileList.innerHTML = '';
    
    items.forEach(item => {
        const fileElement = createFileElement(item);
        fileList.appendChild(fileElement);
    });
}

// 创建文件元素
function createFileElement(item) {
    const fileDiv = document.createElement('div');
    fileDiv.className = `file-item ${item.isDirectory ? 'directory' : 'file'}`;
    
    const icon = getFileIcon(item);
    const size = item.isDirectory ? '' : formatFileSize(item.size);
    const date = new Date(item.lastModified).toLocaleDateString('zh-CN');
    
    fileDiv.innerHTML = `
        <div class="file-content" onclick="${item.isDirectory ? `openDirectory('${escapeHtml(item.path)}')` : `downloadFile('${escapeHtml(item.path)}')`}">
            <div class="file-icon ${icon.class}">
                <i class="${icon.icon}"></i>
            </div>
            <div class="file-name">${escapeHtml(item.name)}</div>
            <div class="file-info">
                ${size ? `大小: ${size} | ` : ''}修改时间: ${date}
            </div>
        </div>
        <div class="file-actions">
            ${item.isDirectory ?
                `<button class="btn btn-primary file-action-btn" onclick="openDirectory('${escapeHtml(item.path)}')">
                    <i class="fas fa-folder-open"></i> 打开
                </button>` :
                `<button class="btn btn-info file-action-btn" onclick="downloadFile('${escapeHtml(item.path)}')">
                    <i class="fas fa-download"></i> 下载
                </button>
                <button class="btn btn-secondary file-action-btn" onclick="copyFileUrl('${escapeHtml(item.path)}')">
                    <i class="fas fa-copy"></i> 复制链接
                </button>
                ${isEditableFile(item.name) ?
                    `<button class="btn btn-warning file-action-btn" onclick="editFile('${escapeHtml(item.path)}')">
                        <i class="fas fa-edit"></i> 编辑
                    </button>` : ''
                }`
            }
            <button class="btn btn-danger file-action-btn" onclick="deleteItem('${escapeHtml(item.path)}', '${escapeHtml(item.name)}')">
                <i class="fas fa-trash"></i> 删除
            </button>
        </div>
    `;

    // 阻止文件操作按钮的事件冒泡
    const fileActions = fileDiv.querySelector('.file-actions');
    fileActions.addEventListener('click', (e) => {
        e.stopPropagation();
    });

    return fileDiv;
}

// 获取文件图标
function getFileIcon(item) {
    if (item.isDirectory) {
        return { icon: 'fas fa-folder', class: 'directory' };
    }
    
    const ext = item.name.split('.').pop().toLowerCase();
    
    const iconMap = {
        // 图片
        'jpg': { icon: 'fas fa-image', class: 'image' },
        'jpeg': { icon: 'fas fa-image', class: 'image' },
        'png': { icon: 'fas fa-image', class: 'image' },
        'gif': { icon: 'fas fa-image', class: 'image' },
        'svg': { icon: 'fas fa-image', class: 'image' },
        
        // 文档
        'pdf': { icon: 'fas fa-file-pdf', class: 'document' },
        'doc': { icon: 'fas fa-file-word', class: 'document' },
        'docx': { icon: 'fas fa-file-word', class: 'document' },
        'xls': { icon: 'fas fa-file-excel', class: 'document' },
        'xlsx': { icon: 'fas fa-file-excel', class: 'document' },
        'ppt': { icon: 'fas fa-file-powerpoint', class: 'document' },
        'pptx': { icon: 'fas fa-file-powerpoint', class: 'document' },
        'txt': { icon: 'fas fa-file-alt', class: 'document' },
        'md': { icon: 'fab fa-markdown', class: 'document' },
        
        // 代码
        'js': { icon: 'fab fa-js-square', class: 'code' },
        'html': { icon: 'fab fa-html5', class: 'code' },
        'css': { icon: 'fab fa-css3-alt', class: 'code' },
        'json': { icon: 'fas fa-file-code', class: 'code' },
        'xml': { icon: 'fas fa-file-code', class: 'code' },
        'py': { icon: 'fab fa-python', class: 'code' },
        'java': { icon: 'fab fa-java', class: 'code' },
        
        // 压缩包
        'zip': { icon: 'fas fa-file-archive', class: 'archive' },
        'rar': { icon: 'fas fa-file-archive', class: 'archive' },
        '7z': { icon: 'fas fa-file-archive', class: 'archive' },
        'tar': { icon: 'fas fa-file-archive', class: 'archive' },
        'dmg': { icon: 'fas fa-file-archive', class: 'archive' },
    };
    
    return iconMap[ext] || { icon: 'fas fa-file', class: 'file' };
}

// 格式化文件大小
function formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 判断是否可编辑文件
function isEditableFile(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const editableExtensions = ['txt', 'json', 'csv', 'tsv', 'xml', 'html', 'css', 'js', 'md', 'yaml', 'yml', 'ini', 'conf', 'log'];
    return editableExtensions.includes(ext);
}

// 更新面包屑导航
function updateBreadcrumb(path) {
    const pathParts = path ? path.split('/').filter(part => part) : [];
    
    let breadcrumbHtml = '<span class="breadcrumb-item" onclick="loadFileList(\'\')"><i class="fas fa-home"></i> 根目录</span>';
    
    if (pathParts.length > 0) {
        let currentPath = '';
        pathParts.forEach((part, index) => {
            currentPath += (currentPath ? '/' : '') + part;
            breadcrumbHtml += `<span class="breadcrumb-separator">/</span>`;
            breadcrumbHtml += `<span class="breadcrumb-item" onclick="loadFileList('${currentPath}')">${escapeHtml(part)}</span>`;
        });
    }
    
    breadcrumbPath.innerHTML = breadcrumbHtml;
}

// 显示空状态
function displayEmptyState(message) {
    fileList.innerHTML = `
        <div class="empty-state">
            <i class="fas fa-folder-open"></i>
            <p>${message}</p>
        </div>
    `;
}

// 显示/隐藏加载状态
function showLoading(show) {
    loading.style.display = show ? 'block' : 'none';
    fileList.style.display = show ? 'none' : 'grid';
}

// 文件操作函数
function openDirectory(path) {
    loadFileList(path);
}

function downloadFile(path) {
    const downloadUrl = `/api/download/${encodeURIComponent(path)}`;
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = '';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showMessage('开始下载文件', 'info');
}

function copyFileUrl(path) {
    const fileUrl = `${window.location.origin}/api/download/${encodeURIComponent(path)}`;
    
    // 使用现代的 Clipboard API
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(fileUrl).then(() => {
            showMessage('文件链接已复制到剪贴板', 'success');
        }).catch(err => {
            console.error('复制失败:', err);
            fallbackCopyTextToClipboard(fileUrl);
        });
    } else {
        // 回退方案
        fallbackCopyTextToClipboard(fileUrl);
    }
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    
    // 避免滚动到底部
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showMessage('文件链接已复制到剪贴板', 'success');
        } else {
            showMessage('复制失败，请手动复制链接', 'error');
        }
    } catch (err) {
        console.error('复制失败:', err);
        showMessage('复制失败，请手动复制链接', 'error');
    }
    
    document.body.removeChild(textArea);
}

async function editFile(path) {
    try {
        const response = await fetch(`/api/edit/${encodeURIComponent(path)}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        editingFilePath = path;
        
        document.getElementById('editFileName').textContent = data.filename;
        document.getElementById('fileContent').value = data.content;
        
        showModal(editModal);
    } catch (error) {
        console.error('读取文件失败:', error);
        showMessage('读取文件失败: ' + error.message, 'error');
    }
}

async function saveFile() {
    if (!editingFilePath) return;
    
    const content = document.getElementById('fileContent').value;
    
    try {
        const response = await fetch(`/api/edit/${encodeURIComponent(editingFilePath)}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ content })
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        hideModal(editModal);
        showMessage('文件保存成功', 'success');
        editingFilePath = '';
    } catch (error) {
        console.error('保存文件失败:', error);
        showMessage('保存文件失败: ' + error.message, 'error');
    }
}

function deleteItem(path, name) {
    document.getElementById('deleteItemName').textContent = name;
    document.getElementById('confirmDeleteBtn').onclick = () => confirmDelete(path);
    showModal(deleteModal);
}

async function confirmDelete(path) {
    try {
        const response = await fetch(`/api/delete/${encodeURIComponent(path)}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        hideModal(deleteModal);
        showMessage('删除成功', 'success');
        loadFileList(currentPath);
    } catch (error) {
        console.error('删除失败:', error);
        showMessage('删除失败: ' + error.message, 'error');
    }
}

// 文件上传处理
function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
}

function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
}

function handleFileDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
        uploadFiles(files);
    }
}

function handleFileSelect(e) {
    const files = e.target.files;
    if (files.length > 0) {
        uploadFiles(files);
    }
}

async function uploadFiles(files) {
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    uploadProgress.style.display = 'block';
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);
        
        try {
            const response = await fetch(`/api/upload?path=${encodeURIComponent(currentPath)}`, {
                method: 'POST',
                body: formData
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const progress = ((i + 1) / files.length) * 100;
            progressFill.style.width = progress + '%';
            progressText.textContent = Math.round(progress) + '%';
            
        } catch (error) {
            console.error('上传文件失败:', error);
            showMessage(`上传文件 ${file.name} 失败: ${error.message}`, 'error');
        }
    }
    
    setTimeout(() => {
        hideModal(uploadModal);
        loadFileList(currentPath);
        showMessage(`成功上传 ${files.length} 个文件`, 'success');
    }, 500);
}

// 创建文件夹
async function createFolder() {
    const name = document.getElementById('folderName').value.trim();
    if (!name) {
        showMessage('请输入文件夹名称', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/mkdir', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path: currentPath,
                name: name
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        hideModal(folderModal);
        loadFileList(currentPath);
        showMessage('文件夹创建成功', 'success');
    } catch (error) {
        console.error('创建文件夹失败:', error);
        showMessage('创建文件夹失败: ' + error.message, 'error');
    }
}

// 创建文件
async function createFile() {
    const name = document.getElementById('fileName').value.trim();
    if (!name) {
        showMessage('请输入文件名称', 'warning');
        return;
    }
    
    try {
        const response = await fetch('/api/create-file', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                path: currentPath,
                name: name,
                content: ''
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        
        hideModal(fileModal);
        loadFileList(currentPath);
        showMessage('文件创建成功', 'success');
    } catch (error) {
        console.error('创建文件失败:', error);
        showMessage('创建文件失败: ' + error.message, 'error');
    }
}

// 加载统计面板
async function loadDashboard() {
    const dashboardContent = document.getElementById('dashboardContent');
    
    try {
        dashboardContent.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i> 加载统计数据中...
            </div>
        `;
        
        const response = await fetch('/api/dashboard/overview');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        displayDashboard(data);
    } catch (error) {
        console.error('加载统计面板失败:', error);
        dashboardContent.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>加载统计数据失败</p>
                <p style="color: #dc3545; font-size: 0.9rem;">${error.message}</p>
            </div>
        `;
    }
}

// 显示统计面板
function displayDashboard(data) {
    const dashboardContent = document.getElementById('dashboardContent');
    
    let platformHtml = '';
    for (const [platform, stats] of Object.entries(data.platformStats)) {
        platformHtml += `
            <div class="platform-item">
                <div class="platform-name">${platform === 'unknown' ? '未知平台' : platform}</div>
                <div class="platform-downloads">下载次数: ${stats.count}</div>
            </div>
        `;
    }
    
    dashboardContent.innerHTML = `
        <div class="dashboard-overview">
            <div class="stat-card">
                <div class="stat-number">${data.totalDownloads}</div>
                <div class="stat-label">总下载次数</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${Object.keys(data.platformStats).length}</div>
                <div class="stat-label">平台数量</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">${data.version}</div>
                <div class="stat-label">当前版本</div>
            </div>
        </div>
        
        <div class="platform-stats">
            <h4>各平台下载统计</h4>
            ${platformHtml || '<p style="color: #6c757d;">暂无下载数据</p>'}
        </div>
    `;
}

// 显示消息提示
function showMessage(message, type = 'info') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${type}`;
    messageDiv.textContent = message;
    
    messageContainer.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.remove();
    }, 5000);
}

// HTML转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}