# 文件管理器 Web 应用

一个基于 Node.js + Express 的文件管理 Web 应用，支持文件和目录的增删改查操作。

## 功能特性

- 📁 **目录管理**: 创建、删除目录
- 📄 **文件操作**: 上传、下载、删除文件
- 🗂️ **文件浏览**: 直观的文件浏览器界面
- 📱 **响应式设计**: 支持桌面端和移动端
- 🔒 **安全防护**: 路径安全检查，防止目录遍历攻击

## 技术栈

- **后端**: Node.js + Express
- **前端**: HTML5 + CSS3 + JavaScript (ES6+)
- **文件上传**: Multer
- **样式**: Font Awesome 图标

## 安装和运行

### 1. 安装依赖
```bash
npm install
```

### 2. 启动服务器
```bash
npm start
```

### 3. 访问应用
服务器同时提供HTTP和HTTPS两种协议：

- **HTTP**: http://localhost:3000 (推荐用于API调用和程序访问)
- **HTTPS**: https://localhost:3443 (用于浏览器访问，需要接受自签名证书)

**注意**: HTTPS使用自签名SSL证书，浏览器会显示安全警告。请点击"高级"然后选择"继续访问localhost"。

## 目录结构

```
file-server/
├── package.json          # 项目配置文件
├── server.js             # 后端服务器
├── public/               # 前端静态资源
│   ├── index.html        # 主页面
│   ├── style.css         # 样式文件
│   └── script.js         # JavaScript 脚本
├── file-explorer/        # 文件存储目录
└── README.md            # 说明文档
```

## API 接口

### 获取文件列表
- **GET** `/api/files?path={path}`
- 获取指定路径下的文件和目录列表

### 创建目录
- **POST** `/api/mkdir`
- Body: `{ "path": "父目录路径", "name": "目录名称" }`

### 上传文件
- **POST** `/api/upload`
- FormData: `file` (文件), `path` (目标路径)

### 下载文件
- **GET** `/api/download/{filePath}`
- 下载指定路径的文件

### 删除文件或目录
- **DELETE** `/api/delete/{itemPath}`
- 删除指定路径的文件或目录

## 使用说明

### 文件浏览
- 点击文件夹图标可以进入子目录
- 点击"返回"按钮返回上级目录
- 路径导航显示当前所在位置

### 创建目录
1. 点击"新建文件夹"按钮
2. 输入文件夹名称
3. 点击"创建"按钮

### 上传文件
1. 点击"上传文件"按钮
2. 选择一个或多个文件
3. 文件将自动上传到当前目录

### 下载文件
- 将鼠标悬停在文件上，点击下载图标

### 删除文件或目录
1. 将鼠标悬停在文件/目录上，点击删除图标
2. 在确认对话框中点击"删除"

## 安全注意事项

- 文件操作仅限于 `file-explorer` 目录内
- 实现了路径遍历攻击防护
- 同时支持HTTP和HTTPS协议
- HTTP端口: 3000 (适合程序调用)
- HTTPS端口: 3443 (适合浏览器访问)
- 建议在生产环境中添加用户认证
- 建议设置文件上传大小限制
- 自签名证书仅用于开发环境，生产环境请使用有效的SSL证书

## 开发模式

使用 nodemon 进行开发（需要先安装 nodemon）:
```bash
npm run dev
```

## 浏览器兼容性

- Chrome 60+
- Firefox 60+
- Safari 12+
- Edge 79+

## 故障排除

### 端口占用
如果 3000 端口被占用，可以通过环境变量修改：
```bash
PORT=8080 npm start
```

### 文件上传失败
- 检查 `file-explorer` 目录权限
- 确认磁盘空间充足
- 检查文件名是否包含特殊字符

## 许可证

MIT License