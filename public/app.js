// 全局变量
let currentPath = '';
let editingFilePath = '';
let findMatches = [];
let currentMatchIndex = -1;

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

    // 查找替换事件
    document.getElementById('findReplaceBtn').addEventListener('click', toggleFindReplacePanel);
    document.getElementById('closeFindReplaceBtn').addEventListener('click', closeFindReplacePanel);
    document.getElementById('findInput').addEventListener('input', performFind);
    document.getElementById('findPrevBtn').addEventListener('click', findPrevious);
    document.getElementById('findNextBtn').addEventListener('click', findNext);
    document.getElementById('replaceBtn').addEventListener('click', replaceCurrentMatch);
    document.getElementById('replaceAllBtn').addEventListener('click', replaceAll);
    document.getElementById('caseSensitiveCheck').addEventListener('change', performFind);
    document.getElementById('wholeWordCheck').addEventListener('change', performFind);

    // 编辑器内容变化事件
    document.getElementById('fileContent').addEventListener('input', updateEditorStats);

    // 编辑器键盘事件
    document.getElementById('fileContent').addEventListener('keydown', handleEditorKeydown);

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
    
    // 重置上传文件容器
    const uploadFilesContainer = document.getElementById('uploadFilesContainer');
    if (uploadFilesContainer) {
        uploadFilesContainer.style.display = 'none';
        uploadFilesContainer.innerHTML = '';
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
        
        updateEditorStats();
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
    const uploadFilesContainer = document.getElementById('uploadFilesContainer');
    
    // 显示文件列表容器
    uploadFilesContainer.style.display = 'block';
    uploadFilesContainer.innerHTML = '';
    
    // 为每个文件创建进度项
    const fileItems = [];
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fileItem = createFileUploadItem(file, i);
        uploadFilesContainer.appendChild(fileItem);
        fileItems.push({
            file: file,
            element: fileItem,
            id: i,
            completed: false
        });
    }
    
    // 并发上传所有文件
    const uploadPromises = fileItems.map(async (fileItem) => {
        try {
            await uploadSingleFile(fileItem);
        } catch (error) {
            console.error('上传文件失败:', error);
            updateFileItemStatus(fileItem, 'error', error.message);
        }
    });
    
    // 等待所有文件上传完成
    await Promise.allSettled(uploadPromises);
    
    // 检查是否所有文件都上传完成
    const completedFiles = fileItems.filter(item => item.completed).length;
    const totalFiles = fileItems.length;
    
    // 显示完成消息
    if (completedFiles === totalFiles) {
        showMessage(`成功上传 ${completedFiles} 个文件`, 'success');
    } else {
        showMessage(`上传完成：${completedFiles}/${totalFiles} 个文件成功`, 'warning');
    }
    
    // 延迟后关闭模态框并刷新列表
    setTimeout(() => {
        hideModal(uploadModal);
        loadFileList(currentPath);
    }, 1500);
}

// 创建单个文件上传项
function createFileUploadItem(file, index) {
    const fileItem = document.createElement('div');
    fileItem.className = 'upload-file-item';
    fileItem.id = `upload-file-${index}`;
    
    fileItem.innerHTML = `
        <div class="upload-file-header">
            <div class="upload-file-name" title="${escapeHtml(file.name)}">
                <i class="fas fa-file upload-file-icon"></i>
                ${escapeHtml(file.name)}
            </div>
            <div class="upload-file-size">${formatFileSize(file.size)}</div>
        </div>
        <div class="upload-file-status uploading">
            <i class="fas fa-spinner fa-spin"></i>
            准备上传...
        </div>
        <div class="upload-file-progress">
            <div class="progress-bar">
                <div class="progress-fill" style="width: 0%"></div>
            </div>
            <div class="progress-text">0%</div>
        </div>
    `;
    
    return fileItem;
}

// 上传单个文件
async function uploadSingleFile(fileItem) {
    const { file, element, id } = fileItem;
    const formData = new FormData();
    formData.append('file', file);
    
    const statusElement = element.querySelector('.upload-file-status');
    const progressFill = element.querySelector('.progress-fill');
    const progressText = element.querySelector('.progress-text');
    const iconElement = element.querySelector('.upload-file-icon');
    
    try {
        // 更新状态为上传中
        statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 上传中...';
        statusElement.className = 'upload-file-status uploading';
        
        await uploadFileWithProgress(file, formData, (progress) => {
            // 更新进度条
            progressFill.style.width = progress + '%';
            progressText.textContent = Math.round(progress) + '%';
            
            // 更新状态文本
            statusElement.innerHTML = `<i class="fas fa-spinner fa-spin"></i> 上传中... ${Math.round(progress)}%`;
        });
        
        // 上传成功
        fileItem.completed = true;
        updateFileItemStatus(fileItem, 'completed', '上传完成');
        
    } catch (error) {
        // 上传失败
        updateFileItemStatus(fileItem, 'error', error.message);
        throw error;
    }
}

// 更新文件项状态
function updateFileItemStatus(fileItem, status, message) {
    const { element } = fileItem;
    const statusElement = element.querySelector('.upload-file-status');
    const iconElement = element.querySelector('.upload-file-icon');
    const progressFill = element.querySelector('.progress-fill');
    const progressText = element.querySelector('.progress-text');
    
    // 移除所有状态类
    element.classList.remove('completed', 'error');
    statusElement.classList.remove('uploading', 'completed', 'error');
    iconElement.classList.remove('completed', 'error');
    
    switch (status) {
        case 'completed':
            element.classList.add('completed');
            statusElement.classList.add('completed');
            iconElement.classList.add('completed');
            statusElement.innerHTML = '<i class="fas fa-check-circle"></i> ' + message;
            iconElement.className = 'fas fa-check-circle upload-file-icon completed';
            progressFill.style.width = '100%';
            progressText.textContent = '100%';
            break;
            
        case 'error':
            element.classList.add('error');
            statusElement.classList.add('error');
            iconElement.classList.add('error');
            statusElement.innerHTML = '<i class="fas fa-exclamation-circle"></i> ' + message;
            iconElement.className = 'fas fa-exclamation-circle upload-file-icon error';
            break;
            
        default:
            statusElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> ' + message;
            statusElement.classList.add('uploading');
            break;
    }
}

// 使用XMLHttpRequest实现带进度监控的文件上传
function uploadFileWithProgress(file, formData, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        
        // 监听上传进度
        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
                const percentComplete = (e.loaded / e.total) * 100;
                onProgress(percentComplete);
            }
        });
        
        // 监听上传完成
        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                resolve(xhr.response);
            } else {
                reject(new Error(`HTTP error! status: ${xhr.status}`));
            }
        });
        
        // 监听上传错误
        xhr.addEventListener('error', () => {
            reject(new Error('上传请求失败'));
        });
        
        // 监听上传中断
        xhr.addEventListener('abort', () => {
            reject(new Error('上传被中断'));
        });
        
        // 配置请求
        xhr.open('POST', `/api/upload?path=${encodeURIComponent(currentPath)}`);
        
        // 发送请求
        xhr.send(formData);
    });
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

// 查找替换功能
function toggleFindReplacePanel() {
    const panel = document.getElementById('findReplacePanel');
    const isVisible = panel.style.display !== 'none';
    
    if (isVisible) {
        closeFindReplacePanel();
    } else {
        panel.style.display = 'block';
        const findInput = document.getElementById('findInput');
        findInput.focus();
        
        // 如果编辑器中有选中的文本，自动填入查找框
        const editor = document.getElementById('fileContent');
        const selectedText = editor.value.substring(editor.selectionStart, editor.selectionEnd);
        if (selectedText) {
            findInput.value = selectedText;
            performFind();
        }
    }
}

function closeFindReplacePanel() {
    const panel = document.getElementById('findReplacePanel');
    panel.style.display = 'none';
    clearHighlights();
    findMatches = [];
    currentMatchIndex = -1;
    
    // 清空输入框
    document.getElementById('findInput').value = '';
    document.getElementById('replaceInput').value = '';
    document.getElementById('findStatus').textContent = '';
}

function performFind() {
    const findText = document.getElementById('findInput').value;
    const editor = document.getElementById('fileContent');
    const content = editor.value;
    
    clearHighlights();
    findMatches = [];
    currentMatchIndex = -1;
    
    if (!findText) {
        document.getElementById('findStatus').textContent = '';
        return;
    }

    const caseSensitive = document.getElementById('caseSensitiveCheck').checked;
    const wholeWord = document.getElementById('wholeWordCheck').checked;
    
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
        
        findMatches.push({
            start: foundIndex,
            end: foundIndex + findText.length
        });
        
        index = foundIndex + 1;
    }

    updateFindStatus();
    
    if (findMatches.length > 0) {
        currentMatchIndex = 0;
        scrollToCurrentMatch();
    }
}

function findNext() {
    if (findMatches.length === 0) return;
    
    currentMatchIndex = (currentMatchIndex + 1) % findMatches.length;
    scrollToCurrentMatch();
    updateFindStatus();
}

function findPrevious() {
    if (findMatches.length === 0) return;
    
    currentMatchIndex = currentMatchIndex <= 0 ?
        findMatches.length - 1 : currentMatchIndex - 1;
    scrollToCurrentMatch();
    updateFindStatus();
}

function replaceCurrentMatch() {
    if (findMatches.length === 0 || currentMatchIndex === -1) {
        showMessage('没有找到要替换的内容', 'warning');
        return;
    }

    const replaceText = document.getElementById('replaceInput').value;
    const editor = document.getElementById('fileContent');
    const currentMatch = findMatches[currentMatchIndex];
    
    // 执行替换
    const content = editor.value;
    const newContent = content.substring(0, currentMatch.start) +
                      replaceText +
                      content.substring(currentMatch.end);
    
    editor.value = newContent;
    
    // 重新查找以更新匹配位置
    const findText = document.getElementById('findInput').value;
    if (findText) {
        performFind();
    }
    
    updateEditorStats();
    showMessage('替换成功', 'success');
}

function replaceAll() {
    if (findMatches.length === 0) {
        showMessage('没有找到要替换的内容', 'warning');
        return;
    }

    const replaceText = document.getElementById('replaceInput').value;
    const findText = document.getElementById('findInput').value;
    const editor = document.getElementById('fileContent');
    
    const caseSensitive = document.getElementById('caseSensitiveCheck').checked;
    const wholeWord = document.getElementById('wholeWordCheck').checked;
    
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
    updateEditorStats();
    
    // 清除高亮并重新查找
    clearHighlights();
    findMatches = [];
    currentMatchIndex = -1;
    performFind();
    
    showMessage(`成功替换 ${replaceCount} 处`, 'success');
}

function scrollToCurrentMatch() {
    if (currentMatchIndex === -1 || findMatches.length === 0) return;
    
    const editor = document.getElementById('fileContent');
    const currentMatch = findMatches[currentMatchIndex];
    
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

function updateFindStatus() {
    const statusElement = document.getElementById('findStatus');
    
    if (findMatches.length === 0) {
        statusElement.textContent = '未找到';
        statusElement.className = 'find-status not-found';
    } else {
        statusElement.textContent = `${currentMatchIndex + 1} / ${findMatches.length}`;
        statusElement.className = 'find-status found';
    }
}

function clearHighlights() {
    // 清除高亮的简化实现
    // 在真实的编辑器中，通常需要更复杂的文本高亮逻辑
}

function updateEditorStats() {
    const editor = document.getElementById('fileContent');
    const content = editor.value;
    
    const lines = content.split('\n').length;
    const chars = content.length;
    
    const statsElement = document.getElementById('editorStats');
    if (statsElement) {
        statsElement.textContent = `行: ${lines}, 字符: ${chars}`;
    }
}

function handleEditorKeydown(e) {
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        toggleFindReplacePanel();
    }
    if (e.key === 'Escape') {
        closeFindReplacePanel();
    }
    if (e.ctrlKey && e.key === 'h') {
        e.preventDefault();
        toggleFindReplacePanel();
        // 聚焦到替换输入框
        setTimeout(() => {
            document.getElementById('replaceInput').focus();
        }, 100);
    }
}